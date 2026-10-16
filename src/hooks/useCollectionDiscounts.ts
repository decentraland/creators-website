import { useEffect, useMemo, useState } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  readTransactionOutcome,
  requireAccount,
  sendWalletTransaction,
  signTypedData,
  waitForTransaction,
  type Session
} from '~/lib/auth'
import { errorCode, track } from '~/lib/analytics'
import {
  DiscountError,
  createDiscount,
  endDiscount,
  fetchCreatorDiscounts,
  findStoredDiscount,
  openDiscountsFor,
  postCoupon,
  readCouponIndexes,
  storeSignedDiscount,
  toDiscountError,
  type CollectionDiscount,
  type CouponCreation,
  type DiscountTerms
} from '~/lib/coupons'
import { type Collection } from '~/lib/collections'
import {
  clearPendingEnd,
  clearUnconfirmedCreate,
  pendingEndOf,
  pendingEnds,
  resetDiscountAttempts,
  savePendingEnd,
  saveUnconfirmedCreate
} from '~/lib/discountAttempts'
import { FeatureFlag } from '~/lib/featureFlags'
import { getMaticChainId } from '~/lib/publishCollection'
import { useFeatureFlag } from '~/hooks/useFeatureFlag'
import { captureError } from '~/lib/monitoring'

export const DISCOUNT_OPENED_EVENT = 'Open create collection discount'
const DISCOUNT_CREATED_EVENT = 'Create collection discount'
const DISCOUNT_FAILED_EVENT = 'Create collection discount error'
const DISCOUNT_ENDED_EVENT = 'End collection discount'
const DISCOUNT_END_FAILED_EVENT = 'End collection discount error'

// Discounts whose cancellation this tab saw mined. The server reads a coupon's state on its own schedule, so a refetch
// right after can still report it running, and End must not come back for it. Cancellations sent but not seen
// mined are kept in `lib/discountAttempts`, which survives a reload.
const endedInSession = new Set<string>()
// The last discount this tab created per collection, so a dialog reopened during a create can tell it went through.
const createdFor = new Map<string, string>()

/** Whether any discount is being created or ended in this tab, dialog open or not, for the leave-page guard. */
export function useAnyDiscountInFlight(): boolean {
  return useIsMutating({ mutationKey: CREATE_KEY }) + useIsMutating({ mutationKey: END_KEY }) > 0
}

/** Forgets this tab's outcomes; for specs, which share the module between cases. */
export function resetDiscountSession(): void {
  endedInSession.clear()
  createdFor.clear()
  resetDiscountAttempts()
}

/** Whether a discount's cancellation was seen mined, or sent and not yet settled, here or before a reload. */
export function endOutcome(address: string, discountId: string): 'ended' | 'pending' | undefined {
  if (endedInSession.has(discountId)) return 'ended'
  return pendingEndOf(address, discountId) ? 'pending' : undefined
}

// A cancellation with no receipt this long after it was sent was dropped or replaced: End may be offered again,
// and if a replacement did mine, the server reports the discount cancelled on its next read.
const PENDING_END_MAX_AGE_MS = 30 * 60_000

/**
 * Settles the cancellations sent but not seen mined against the chain: mined ends the discount, reverted or dropped
 * brings End back. Answers the discounts whose cancellation is still unsettled.
 */
async function reconcilePendingEnds(address: string, now = Date.now()): Promise<string[]> {
  for (const end of pendingEnds(address)) {
    const outcome = await readTransactionOutcome(end.chainId, end.txHash).catch(() => 'unknown' as const)
    if (outcome === 'mined') endedInSession.add(end.discountId)
    if (outcome !== 'unknown' || now - end.sentAt > PENDING_END_MAX_AGE_MS) clearPendingEnd(address, end.discountId)
  }
  return pendingEnds(address).map(end => end.discountId)
}

/** The id of the last discount this tab created for the collection. */
export function lastCreatedDiscount(collectionId: string): string | undefined {
  return createdFor.get(collectionId)
}

// A sped-up or replaced transaction gets a new hash this one never sees mined, so the wait gives up.
const END_TIMEOUT_MS = 5 * 60_000

const CREATE_KEY = ['create-collection-discount']
const END_KEY = ['end-collection-discount']

// Expected states the creator resolves themselves are tracked as events, not reported as errors.
const isReportable = (error: unknown) => !['rejected', 'wallet', 'pending'].includes(toDiscountError(error).reason)

/**
 * Whether a discount is still being created for the collection, or ended, in this tab. Read from the mutation
 * cache, so it survives closing and reopening the dialog while a wallet prompt is still open.
 */
export function useDiscountInFlight({ collectionId, discountId }: { collectionId?: string; discountId?: string }) {
  const creating = useIsMutating({
    mutationKey: CREATE_KEY,
    predicate: mutation =>
      !!collectionId &&
      (mutation.state.variables as CreateDiscountVariables | undefined)?.collection.id === collectionId
  })
  const ending = useIsMutating({
    mutationKey: END_KEY,
    predicate: mutation =>
      !!discountId && (mutation.state.variables as EndDiscountVariables | undefined)?.discount.id === discountId
  })
  return { creating: creating > 0, ending: ending > 0 }
}

const discountsKey = (address: string | undefined) => ['collection-discounts', address?.toLowerCase()]

export type DiscountFlags = {
  /** The Shop applies creator discounts for buyers, so running ones matter and can be ended here. */
  shopApplies: boolean
  /** Creators may also create discounts here. */
  enabled: boolean
  /** The Shop discounts MANA listings too. `undefined` while that is still being read. */
  manaListings: boolean | undefined
}

/** Both switches a discount needs (this app's and the Shop's), plus whether it reaches MANA listings. */
export function useDiscountFlags(): DiscountFlags {
  const shop = useFeatureFlag(FeatureFlag.SHOP_CREATOR_SALES)
  const own = useFeatureFlag(FeatureFlag.COLLECTION_DISCOUNTS, { enabled: shop.enabled })
  const enabled = own.enabled && shop.enabled
  const mana = useFeatureFlag(FeatureFlag.SHOP_LEGACY_COUPONS, { enabled })
  return { shopApplies: shop.enabled, enabled, manaListings: mana.isLoading ? undefined : mana.enabled }
}

/** The collection's running and scheduled discounts, signed by `address`. Off without either. */
export function useCollectionDiscounts(address: string | undefined, contractAddress: string | undefined) {
  const query = useQuery({
    queryKey: discountsKey(address),
    queryFn: () => fetchCreatorDiscounts(address!),
    enabled: !!address && !!contractAddress,
    staleTime: 30_000
  })
  // Re-evaluated every minute, so a discount that ran out loses its End button without a refetch.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  // Polled while any cancellation is unsettled, including one sent before a reload.
  const reconcile = useQuery({
    queryKey: ['collection-discount-ends', address?.toLowerCase()],
    queryFn: () => reconcilePendingEnds(address!),
    enabled: !!address && !!contractAddress,
    refetchInterval: query => ((query.state.data?.length ?? 0) > 0 ? 30_000 : false)
  })
  const discounts = useMemo(
    () =>
      query.data && contractAddress && address
        ? openDiscountsFor(query.data, contractAddress, now)
            .filter(discount => !endedInSession.has(discount.id))
            // Still listed while its cancellation is unsettled: it keeps applying until that mines.
            .map(discount =>
              reconcile.data?.includes(discount.id) || pendingEndOf(address, discount.id)
                ? { ...discount, ending: true }
                : discount
            )
        : undefined,
    [query.data, contractAddress, address, now, reconcile.data]
  )
  return { ...query, discounts, now }
}

function updateDiscounts(
  queryClient: QueryClient,
  address: string,
  update: (discounts: CollectionDiscount[]) => CollectionDiscount[]
) {
  const key = discountsKey(address)
  // A list that never loaded is refetched rather than seeded: seeding it would hide every other discount.
  if (queryClient.getQueryData<CollectionDiscount[]>(key)) {
    queryClient.setQueryData<CollectionDiscount[]>(key, current => update(current!))
  } else {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

export type CreateDiscountVariables = Omit<DiscountTerms, 'collections'> & {
  collection: Collection
  /** A coupon already signed whose storing is unconfirmed: it is stored again (or found stored), never re-signed. */
  resume?: CouponCreation
  /** Listings the discount re-prices, for the event. */
  discountedCount: number
  /** The wallet prompt is over; the discount is being stored. */
  onSigned?: () => void
}

function discountProps(variables: CreateDiscountVariables) {
  return {
    collectionId: variables.collection.id,
    discountPct: variables.discountPct,
    durationDays: Math.round((variables.endsAtMs - (variables.startsAtMs ?? Date.now())) / 86_400_000),
    capped: variables.uses !== undefined,
    discountedCount: variables.discountedCount
  }
}

/** Signs a discount over the collection and stores it; the Shop applies it as soon as it starts. */
export function useCreateDiscount(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationKey: CREATE_KEY,
    mutationFn: ({
      collection,
      discountPct,
      startsAtMs,
      endsAtMs,
      uses,
      onSigned,
      resume
    }: CreateDiscountVariables) => {
      if (!session) throw new Error('Wallet disconnected')
      const store = {
        postCoupon: (payload: CouponCreation) => postCoupon(session.address, payload),
        findStored: findStoredDiscount
      }
      if (resume) return storeSignedDiscount(resume, store)
      return createDiscount(
        {
          signer: session.address,
          chainId,
          collections: [collection.contractAddress!],
          discountPct,
          startsAtMs,
          endsAtMs,
          uses
        },
        {
          readIndexes: readCouponIndexes,
          // The coupon is posted as `session.address`: signed by another account, the server would refuse it.
          signTypedData: async (domain, types, value) => {
            await requireAccount(session)
            return signTypedData(session, domain, types, value)
          },
          ...store,
          onSigned,
          onSignedPayload: payload =>
            saveUnconfirmedCreate(session.address, { collectionId: collection.id, payload, signedAt: Date.now() })
        }
      )
    },
    onSuccess: (discount, variables) => {
      track(DISCOUNT_CREATED_EVENT, { ...discountProps(variables), discountId: discount.id })
      createdFor.set(variables.collection.id, discount.id)
      if (session) clearUnconfirmedCreate(session.address, variables.collection.id)
      if (session) {
        updateDiscounts(queryClient, session.address, current => [
          discount,
          ...current.filter(entry => entry.id !== discount.id)
        ])
      }
    },
    // Here rather than in the dialog: a prompt the creator backed out of, or closed the dialog on, still fails.
    onError: (error, variables) => {
      track(DISCOUNT_FAILED_EVENT, { ...discountProps(variables), error: errorCode(error) })
      // Refused outright, so never stored: the creator may sign a new one. Unconfirmed keeps it for a retry.
      if (session && toDiscountError(error).reason === 'refused') {
        clearUnconfirmedCreate(session.address, variables.collection.id)
      }
      if (isReportable(error)) {
        captureError(error, { flow: 'create_collection_discount', collectionId: variables.collection.id })
      }
    }
  })
}

export type EndDiscountVariables = {
  discount: CollectionDiscount
  collection: Collection
  /** The wallet prompt is over; the cancellation is mining. */
  onSigned?: () => void
}

/** Ends a discount from the wallet (the coupon manager takes no meta-transactions) and waits until it is mined. */
export function useEndDiscount(session: Session | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: END_KEY,
    mutationFn: ({ discount, onSigned }: EndDiscountVariables) => {
      if (!session) throw new Error('Wallet disconnected')
      // Cancellations are keyed by the caller: only the signer's own cancellation ends the coupon.
      if (session.address.toLowerCase() !== discount.signer.toLowerCase()) {
        throw new DiscountError(
          'generic',
          `Discount ${discount.id} was signed by ${discount.signer}, not ${session.address}`
        )
      }
      return endDiscount(discount, {
        sendTransaction: call => sendWalletTransaction(session, call),
        waitForTransaction: hash => waitForTransaction(discount.chainId, hash, END_TIMEOUT_MS),
        onSigned,
        onBroadcast: txHash =>
          savePendingEnd(session.address, {
            discountId: discount.id,
            txHash,
            chainId: discount.chainId,
            sentAt: Date.now()
          })
      })
    },
    onSuccess: (_, { discount, collection }) => {
      track(DISCOUNT_ENDED_EVENT, { collectionId: collection.id, discountId: discount.id })
      endedInSession.add(discount.id)
      if (session) {
        clearPendingEnd(session.address, discount.id)
        updateDiscounts(queryClient, session.address, current =>
          current.map(entry => (entry.id === discount.id ? { ...entry, status: 'cancelled' as const } : entry))
        )
      }
    },
    onError: (error, { discount, collection }) => {
      // Pending stays recorded (it was saved at broadcast) until reconciled against the chain; a confirmed revert
      // ended nothing, so End comes back.
      if (session) {
        if (toDiscountError(error).reason !== 'pending') clearPendingEnd(session.address, discount.id)
        updateDiscounts(queryClient, session.address, current => [...current])
        void queryClient.invalidateQueries({ queryKey: ['collection-discount-ends', session.address.toLowerCase()] })
      }
      if (isReportable(error)) {
        captureError(error, { flow: 'end_collection_discount', collectionId: collection.id, discountId: discount.id })
      }
      track(DISCOUNT_END_FAILED_EVENT, {
        collectionId: collection.id,
        discountId: discount.id,
        error: errorCode(error)
      })
    }
  })
}
