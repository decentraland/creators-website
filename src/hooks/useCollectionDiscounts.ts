import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { sendWalletTransaction, signTypedData, waitForTransaction, type Session } from '~/lib/auth'
import { errorCode, track } from '~/lib/analytics'
import {
  DiscountError,
  createDiscount,
  endDiscount,
  fetchCreatorDiscounts,
  openDiscountsFor,
  postCoupon,
  readCouponIndexes,
  type CollectionDiscount,
  type DiscountTerms
} from '~/lib/coupons'
import { type Collection } from '~/lib/collections'
import { FeatureFlag } from '~/lib/featureFlags'
import { getMaticChainId } from '~/lib/publishCollection'
import { useFeatureFlag } from '~/hooks/useFeatureFlag'

export const DISCOUNT_CREATED_EVENT = 'Create collection discount'
export const DISCOUNT_FAILED_EVENT = 'Create collection discount error'
export const DISCOUNT_ENDED_EVENT = 'End collection discount'
export const DISCOUNT_END_FAILED_EVENT = 'End collection discount error'

// Discounts this tab ended: the server reads a coupon's state on its own schedule, so a refetch right after the
// cancellation is mined can still report it running, and the End button must not come back for it.
const endedInSession = new Set<string>()

// A sped-up or replaced transaction gets a new hash this one never sees mined, so the wait gives up.
const END_TIMEOUT_MS = 5 * 60_000

const discountsKey = (address: string | undefined) => ['collection-discounts', address?.toLowerCase()]

export type DiscountFlags = {
  /** Creators may create and end discounts here, and the Shop applies them for buyers. */
  enabled: boolean
  /** The Shop discounts MANA listings too. `undefined` while that is still being read. */
  manaListings: boolean | undefined
}

/** Both switches a discount needs (this app's and the Shop's), plus whether it reaches MANA listings. */
export function useDiscountFlags(): DiscountFlags {
  const own = useFeatureFlag(FeatureFlag.COLLECTION_DISCOUNTS)
  const shop = useFeatureFlag(FeatureFlag.SHOP_CREATOR_SALES, { enabled: own.enabled })
  const enabled = own.enabled && shop.enabled
  const mana = useFeatureFlag(FeatureFlag.SHOP_LEGACY_COUPONS, { enabled })
  return { enabled, manaListings: mana.isLoading ? undefined : mana.enabled }
}

/** The collection's running and scheduled discounts, signed by `address`. Off without either. */
export function useCollectionDiscounts(address: string | undefined, contractAddress: string | undefined) {
  const query = useQuery({
    queryKey: discountsKey(address),
    queryFn: () => fetchCreatorDiscounts(address!),
    enabled: !!address && !!contractAddress,
    staleTime: 30_000
  })
  const discounts = useMemo(
    () =>
      query.data && contractAddress
        ? openDiscountsFor(query.data, contractAddress).filter(discount => !endedInSession.has(discount.id))
        : undefined,
    [query.data, contractAddress]
  )
  return { ...query, discounts }
}

function updateDiscounts(
  queryClient: QueryClient,
  address: string,
  update: (discounts: CollectionDiscount[]) => CollectionDiscount[]
) {
  queryClient.setQueryData<CollectionDiscount[]>(discountsKey(address), current => update(current ?? []))
}

export type CreateDiscountVariables = Omit<DiscountTerms, 'collections'> & {
  collection: Collection
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
    mutationFn: ({ collection, discountPct, startsAtMs, endsAtMs, uses, onSigned }: CreateDiscountVariables) => {
      if (!session) throw new Error('Wallet disconnected')
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
          signTypedData: (domain, types, value) => signTypedData(session, domain, types, value),
          postCoupon: payload => postCoupon(session.address, payload),
          onSigned
        }
      )
    },
    onSuccess: (discount, variables) => {
      track(DISCOUNT_CREATED_EVENT, { ...discountProps(variables), discountId: discount.id })
      if (session) updateDiscounts(queryClient, session.address, current => [discount, ...current])
    },
    onError: (error, variables) =>
      track(DISCOUNT_FAILED_EVENT, { ...discountProps(variables), error: errorCode(error) })
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
        onSigned
      })
    },
    onSuccess: (_, { discount, collection }) => {
      track(DISCOUNT_ENDED_EVENT, { collectionId: collection.id, discountId: discount.id })
      endedInSession.add(discount.id)
      if (session) {
        updateDiscounts(queryClient, session.address, current =>
          current.map(entry => (entry.id === discount.id ? { ...entry, status: 'cancelled' as const } : entry))
        )
      }
    },
    onError: (error, { discount, collection }) =>
      track(DISCOUNT_END_FAILED_EVENT, {
        collectionId: collection.id,
        discountId: discount.id,
        error: errorCode(error)
      })
  })
}
