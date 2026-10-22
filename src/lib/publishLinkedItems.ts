// The linked-collection publish sequence, ported from the legacy builder's thirdParty sagas
// (handlePublishAndPushChangesThirdPartyItemRequest + Success): record the ToS, buy the missing item slots on the
// ThirdPartyRegistry when needed (registering the third party on its first publish), then hand the signed slots
// cheque to builder-server, which opens one item curation per item, and finally push changes of already-reviewed
// items. Server and chain access is injected so the sequence runs against fakes in tests.
import { ethers } from 'ethers'
import { type ContractCall, type TransactionSettlement } from '~/lib/auth'
import { BuilderServerError, type PublishLinkedItemsResult, type SlotsCheque } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { type ItemCuration } from '~/lib/linkedItemStatus'
import { buildManaApproveCall } from '~/lib/mana'
import { type PushLinkedResult } from '~/lib/pushLinkedChanges'
import { type ThirdParty } from '~/lib/thirdParty'
import {
  buildAddThirdPartyCall,
  buildBuyItemSlotsCall,
  getThirdPartyRegistry,
  type RegisteredThirdParty,
  type ThirdPartyPrice
} from '~/lib/thirdPartyRegistry'
import { isWalletRejection } from '~/lib/walletErrors'

export type LinkedPublishStep =
  'tos' | 'kind' | 'allowance' | 'register' | 'buy_slots' | 'wait_tx' | 'delete_virtual' | 'publish' | 'push'

export type LinkedPublishFailureReason =
  | 'rejected'
  | 'reverted'
  | 'payment_pending'
  | 'fee_changed'
  | 'insufficient_slots'
  | 'pending_review'
  | 'tos_failed'
  | 'generic'

/** A registration or slot purchase this run sent. */
export type LinkedPayment = {
  txHash: string
  /** `addThirdParties`: the virtual third party must still be removed once the chain has it. */
  registration: boolean
}

export class LinkedPublishError extends Error {
  step: LinkedPublishStep
  reason: LinkedPublishFailureReason
  /** The underlying failure, when this one wraps it. */
  cause?: unknown
  /**
   * The registration or slot purchase this run sent: the one that reverted for 'reverted', otherwise a payment that
   * may already be on chain, which a retry must resume from instead of paying again.
   */
  txHash?: string
  /** The payment this run sent, when it got that far: a retry resumes from it instead of paying again. */
  payment?: LinkedPayment

  constructor(
    step: LinkedPublishStep,
    reason: LinkedPublishFailureReason,
    message: string = reason,
    cause?: unknown,
    txHash?: string
  ) {
    super(message)
    this.name = 'LinkedPublishError'
    this.step = step
    this.reason = reason
    this.cause = cause
    this.txHash = txHash
  }
}

// builder-server's publish endpoint answers both with 409: InsufficientSlotsError and, for a collection that
// already has a pending item curation, AlreadyPublishedCollectionError.
const CONFLICT_STATUS = 409
const INSUFFICIENT_SLOTS_PATTERN = /slots/i
const PENDING_REVIEW_PATTERN = /already has published items/i

function hasStatus(error: unknown, status: number): error is BuilderServerError {
  return error instanceof BuilderServerError && error.status === status
}

function isServerFailure(error: unknown): boolean {
  return error instanceof BuilderServerError && error.status >= 500
}

export function isInsufficientSlotsError(error: unknown): boolean {
  return hasStatus(error, CONFLICT_STATUS) && INSUFFICIENT_SLOTS_PATTERN.test(error.message)
}

export function isPendingReviewError(error: unknown): boolean {
  return hasStatus(error, CONFLICT_STATUS) && PENDING_REVIEW_PATTERN.test(error.message)
}

/** Maps any failure of the sequence to the reason the UI shows copy for, keeping the step it happened at. */
export function toLinkedPublishError(
  error: unknown,
  step: LinkedPublishStep,
  payment?: LinkedPayment
): LinkedPublishError {
  const wrapped = wrapLinkedPublishError(error, step, payment?.txHash)
  if (payment) {
    wrapped.payment ??= payment
    wrapped.txHash ??= payment.txHash
  }
  return wrapped
}

function wrapLinkedPublishError(error: unknown, step: LinkedPublishStep, txHash?: string): LinkedPublishError {
  if (error instanceof LinkedPublishError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (step === 'tos') return new LinkedPublishError(step, 'tos_failed', message, error, txHash)
  if (isWalletRejection(error)) return new LinkedPublishError(step, 'rejected', message, error, txHash)
  if (isInsufficientSlotsError(error)) return new LinkedPublishError(step, 'insufficient_slots', message, error, txHash)
  if (isPendingReviewError(error)) return new LinkedPublishError(step, 'pending_review', message, error, txHash)
  return new LinkedPublishError(step, 'generic', message, error, txHash)
}

/**
 * The payment a retry must resume from: a registration or slot purchase that was sent and did not revert. Paying
 * again would charge the creator twice (or revert, for a registration).
 */
export function getResumablePayment(error: LinkedPublishError): LinkedPayment | undefined {
  return error.reason === 'reverted' ? undefined : error.payment
}

export type LinkedSlots = {
  /** Free slots, counting any the registry sold that builder-server hasn't indexed yet. */
  available: number
  /** Whether the registry has the third party, even if builder-server still reads it as virtual. */
  registered: boolean
}

/**
 * builder-server counts free slots against its indexed `maxItems`, which lags the registry after a purchase; adding
 * the difference tells a purchase still being indexed apart from one that never happened, so it is never bought twice.
 */
export function getLinkedSlots(
  serverAvailable: number,
  indexedMaxItems: number,
  registry: Pick<RegisteredThirdParty, 'registered' | 'maxItems'>
): LinkedSlots {
  return {
    available: serverAvailable + Math.max(0, registry.maxItems - indexedMaxItems),
    registered: registry.registered
  }
}

/** A publish request that failed on the server may still have written the item curations (see publishWithRetry). */
export function mayHavePublished(error: LinkedPublishError): boolean {
  return error.step === 'publish' && error.reason === 'generic'
}

export type ChequeTypedData = {
  domain: ethers.TypedDataDomain
  types: Record<string, ethers.TypedDataField[]>
  value: { thirdPartyId: string; qty: number; salt: string }
}

/**
 * The EIP-712 "ConsumeSlots" cheque exactly as builder-server verifies it (buildChequeSignatureData) and the
 * registry consumes it: the domain carries the chain id as its salt instead of a chainId field.
 */
export function buildChequeTypedData(
  chainId: number,
  thirdPartyId: string,
  qty: number,
  salt: string
): ChequeTypedData {
  const registry = getThirdPartyRegistry(chainId)
  return {
    domain: {
      name: registry.name,
      version: registry.version,
      verifyingContract: registry.address,
      salt: ethers.utils.hexZeroPad(ethers.utils.hexlify(chainId), 32)
    },
    types: {
      ConsumeSlots: [
        { name: 'thirdPartyId', type: 'string' },
        { name: 'qty', type: 'uint256' },
        { name: 'salt', type: 'bytes32' }
      ]
    },
    value: { thirdPartyId, qty, salt }
  }
}

/** A random 32-byte hex salt; the registry rejects a cheque whose salt was consumed before. */
export function createChequeSalt(): string {
  return ethers.utils.hexlify(crypto.getRandomValues(new Uint8Array(32)))
}

export type SignChequeDeps = {
  signTypedData: (
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ) => Promise<string>
}

/** Signs a cheque for `qty` slots; the wizard asks for it before the paid steps so the wallet prompt comes first. */
export async function signSlotsCheque(
  deps: SignChequeDeps,
  chainId: number,
  thirdPartyId: string,
  qty: number
): Promise<SlotsCheque> {
  const salt = createChequeSalt()
  const { domain, types, value } = buildChequeTypedData(chainId, thirdPartyId, qty, salt)
  const signature = await deps.signTypedData(domain, types, value)
  return { signature, qty, salt }
}

export type SlotsToBuyParams = {
  itemsToPublish: number
  availableSlots: number
  isProgrammatic: boolean
  /** Whether the third party is already on chain. */
  isPublished: boolean
  programmaticMinSlots: number
}

/**
 * Slots to buy for this publish: whatever the items exceed the free slots by. A programmatic third party registers
 * with at least the registry's base pack; after that it still buys its missing slots, which the registry gives it
 * for free (builder-server refuses any publish beyond the available slots).
 */
export function getSlotsToBuy(params: SlotsToBuyParams): number {
  const missing = Math.max(0, params.itemsToPublish - params.availableSlots)
  if (!params.isProgrammatic || params.isPublished) return missing
  return Math.max(missing, params.programmaticMinSlots)
}

export type LinkedPublishFee = {
  usdWei: bigint
  manaWei: bigint
  /** The cap handed to the registry: the MANA price plus the legacy 0.5% pad for oracle drift between quote and tx. */
  maxManaWei: bigint
}

const MAX_PRICE_PAD_NUMERATOR = 1005n
const MAX_PRICE_PAD_DENOMINATOR = 1000n

export type LinkedFeeKind = {
  isProgrammatic: boolean
  /** Whether the third party is already on chain. */
  isPublished: boolean
}

/**
 * What the registry charges for `slotsToBuy`: every slot for a standard third party; only the base pack when a
 * programmatic one registers, whatever extra slots it registers with; nothing once a programmatic one is on chain.
 */
export function getLinkedPublishFee(
  slotsToBuy: number,
  price: ThirdPartyPrice,
  kind: LinkedFeeKind = { isProgrammatic: false, isPublished: false }
): LinkedPublishFee {
  const charged =
    slotsToBuy <= 0 || !kind.isProgrammatic ? slotsToBuy : kind.isPublished ? 0 : price.programmaticMinSlots
  const slots = BigInt(Math.max(0, charged))
  const manaWei = price.itemSlotManaWei * slots
  const padded = manaWei * MAX_PRICE_PAD_NUMERATOR
  const maxManaWei = (padded + MAX_PRICE_PAD_DENOMINATOR - 1n) / MAX_PRICE_PAD_DENOMINATOR
  return { usdWei: price.itemSlotUsdWei * slots, manaWei, maxManaWei }
}

export type LinkedPublishQuote = { slotsToBuy: number; fee: LinkedPublishFee }

/** The slots a publish of `itemCount` items buys given `slots`, and what they cost. */
export function getLinkedPublishQuote(
  itemCount: number,
  slots: LinkedSlots,
  price: ThirdPartyPrice,
  thirdParty: { isProgrammatic: boolean; published: boolean }
): LinkedPublishQuote {
  const isPublished = slots.registered || thirdParty.published
  const slotsToBuy = getSlotsToBuy({
    itemsToPublish: itemCount,
    availableSlots: slots.available,
    isProgrammatic: thirdParty.isProgrammatic,
    isPublished,
    programmaticMinSlots: price.programmaticMinSlots
  })
  return {
    slotsToBuy,
    fee: getLinkedPublishFee(slotsToBuy, price, { isProgrammatic: thirdParty.isProgrammatic, isPublished })
  }
}

export type PublishLinkedParams = {
  address: string
  chainId: number
  collection: Collection
  thirdParty: ThirdParty
  itemsToPublish: Item[]
  itemsToPush: Item[]
  /** Signed by the wizard before this runs; null when nothing is published. */
  cheque: SlotsCheque | null
  email: string
  isProgrammatic: boolean
  slots: LinkedSlots
  price: ThirdPartyPrice
  /** The most the creator agreed to pay: a purchase that would cost more stops with `fee_changed` instead. */
  maxFeeManaWei?: bigint
  /**
   * A registration or slot purchase an earlier attempt already sent: the run waits for it to settle and reads the
   * slots again, so only what is still missing is bought.
   */
  paidTx?: LinkedPayment
  /** An earlier attempt's publish request may have gone through (see publishWithRetry): a pending review then means it did. */
  publishMayHaveLanded?: boolean
}

/** The server and chain calls the sequence needs, so it can run against fakes in tests. */
export type PublishLinkedDeps = {
  saveTOS: (collection: Collection, email: string, hashes: string[]) => Promise<void>
  setThirdPartyKind: (thirdPartyId: string, isProgrammatic: boolean) => Promise<void>
  fetchManaAllowance: (owner: string, spender: string) => Promise<bigint>
  sendTransaction: (call: ContractCall) => Promise<string>
  settleTransaction: (txHash: string) => Promise<TransactionSettlement>
  fetchSlots: () => Promise<LinkedSlots>
  deleteVirtualThirdParty: (thirdPartyId: string) => Promise<void>
  publishLinkedItems: (
    collectionId: string,
    itemIds: string[],
    cheque: SlotsCheque
  ) => Promise<PublishLinkedItemsResult>
  pushChanges: (items: Item[]) => Promise<PushLinkedResult>
  onStep?: (step: LinkedPublishStep) => void
  /**
   * The payment to resume if this run stops, as soon as it changes: set the moment a purchase is sent, cleared once it
   * reverts or is no longer needed. Persisting it here survives a reload mid-run, which a caller's error handler can't.
   */
  onPayment?: (payment: LinkedPayment | undefined) => void
  /** Injected so specs run the retry loops instantly. */
  sleep?: (ms: number) => Promise<void>
}

export type PublishLinkedResult = {
  /** The collection as the publish answered it; undefined when nothing was published. */
  collection?: Collection
  items: Item[]
  itemCurations: ItemCuration[]
  pushed: PushLinkedResult | null
  txHash: string | null
}

const TOS_RETRIES = 3
const TOS_RETRY_DELAY_MS = 500
// Legacy pace for the subgraph to index the registration or the bought slots.
const INDEXING_RETRIES = 20
const INDEXING_RETRY_DELAY_MS = 5000

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function retry<T>(
  times: number,
  delayMs: number,
  fn: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  sleep: (ms: number) => Promise<void>
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < times; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!shouldRetry(error) || attempt === times - 1) break
      await sleep(delayMs)
    }
  }
  throw lastError
}

// A 4xx is the server rejecting what was sent (e.g. the email): the same request will fail again.
function isTransientFailure(error: unknown): boolean {
  return !(error instanceof BuilderServerError && error.status >= 400 && error.status < 500)
}

/**
 * POST /collections/:id/publish, retried while the subgraph has not caught up with the slots just bought (409
 * "exceeds the available slots", or 401 while the registration is unknown to it). The server also creates the
 * collection's forum post inside that request: a Discourse outage makes it answer 500 after the item curations
 * were already written, so a retry then gets 409 "already has published items". That 409 only means the earlier
 * attempt went through, so it counts as success and the caller re-reads the collection; a 409 on the first
 * attempt is a real pending review and still fails.
 */
async function publishWithRetry(
  params: PublishLinkedParams,
  cheque: SlotsCheque,
  deps: PublishLinkedDeps,
  sleep: (ms: number) => Promise<void>
): Promise<PublishLinkedItemsResult | null> {
  const itemIds = params.itemsToPublish.map(item => item.id)
  let serverFailed = !!params.publishMayHaveLanded
  for (let attempt = 0; ; attempt++) {
    try {
      return await deps.publishLinkedItems(params.collection.id, itemIds, cheque)
    } catch (error) {
      if (serverFailed && isPendingReviewError(error)) return null
      const failedNow = isServerFailure(error)
      serverFailed ||= failedNow
      const retriable = failedNow || isInsufficientSlotsError(error) || hasStatus(error, 401)
      if (!retriable || attempt >= INDEXING_RETRIES - 1) throw error
      await sleep(INDEXING_RETRY_DELAY_MS)
    }
  }
}

/**
 * Runs the whole sequence in the legacy order: ToS, third-party kind, MANA allowance, registration or slot
 * purchase, the virtual third party's removal once the chain has it, the publish, then the pushes. Every failure
 * is a LinkedPublishError carrying the step it happened at.
 */
export async function publishLinkedItems(
  params: PublishLinkedParams,
  deps: PublishLinkedDeps
): Promise<PublishLinkedResult> {
  const { address, chainId, collection, itemsToPublish, itemsToPush, cheque, email, isProgrammatic } = params
  const sleep = deps.sleep ?? defaultSleep
  let current: LinkedPublishStep = 'tos'
  const step = (next: LinkedPublishStep) => {
    current = next
    deps.onStep?.(next)
  }
  // A dropped transaction was replaced: by a speed-up that may have bought the same slots, or by a cancel.
  const settle = async (txHash: string): Promise<'mined' | 'dropped'> => {
    const outcome = await deps.settleTransaction(txHash)
    if (outcome === 'reverted') {
      throw new LinkedPublishError(current, 'reverted', `Transaction ${txHash} reverted`, undefined, txHash)
    }
    if (outcome === 'pending') {
      throw new LinkedPublishError(
        current,
        'payment_pending',
        `Transaction ${txHash} is still pending`,
        undefined,
        txHash
      )
    }
    return outcome
  }

  // Kept outside the try so any later failure carries it: a retry must resume from this payment, not repeat it.
  let payment: LinkedPayment | undefined = params.paidTx
  const setPayment = (next: LinkedPayment | undefined) => {
    payment = next
    deps.onPayment?.(next)
  }

  try {
    if (itemsToPublish.length > 0 && !cheque) {
      throw new LinkedPublishError('publish', 'generic', 'A signed cheque is required to publish items')
    }

    step('tos')
    const hashes = [...itemsToPublish, ...itemsToPush]
      .map(item => item.currentContentHash)
      .filter((hash): hash is string => !!hash)
    await retry(
      TOS_RETRIES,
      TOS_RETRY_DELAY_MS,
      () => deps.saveTOS(collection, email, hashes),
      isTransientFailure,
      sleep
    )

    let thirdParty = params.thirdParty
    let txHash: string | null = params.paidTx?.txHash ?? null
    let published: PublishLinkedItemsResult | null = null

    if (itemsToPublish.length > 0 && cheque) {
      let slots = params.slots
      if (params.paidTx) {
        step('wait_tx')
        try {
          await settle(params.paidTx.txHash)
        } catch (error) {
          // It charged nothing: whatever is still missing is bought below, as on a first attempt.
          if (!(error instanceof LinkedPublishError && error.reason === 'reverted')) throw error
          setPayment(undefined)
          txHash = null
        }
        slots = await deps.fetchSlots()
      }
      let registered = slots.registered || thirdParty.published

      // The kind is only chosen before the first publish; the registry fixes it on registration.
      if (!registered && isProgrammatic !== thirdParty.isProgrammatic) {
        step('kind')
        await deps.setThirdPartyKind(thirdParty.id, isProgrammatic)
        thirdParty = { ...thirdParty, isProgrammatic }
      }

      const slotsToBuyFor = (read: LinkedSlots) =>
        getSlotsToBuy({
          itemsToPublish: itemsToPublish.length,
          availableSlots: read.available,
          isProgrammatic: thirdParty.isProgrammatic,
          isPublished: read.registered || thirdParty.published,
          programmaticMinSlots: params.price.programmaticMinSlots
        })
      const slotsToBuy = slotsToBuyFor(slots)

      if (slotsToBuy > 0) {
        const fee = getLinkedPublishFee(slotsToBuy, params.price, {
          isProgrammatic: thirdParty.isProgrammatic,
          isPublished: registered
        })
        if (params.maxFeeManaWei !== undefined && fee.maxManaWei > params.maxFeeManaWei) {
          throw new LinkedPublishError('buy_slots', 'fee_changed')
        }
        const registry = getThirdPartyRegistry(chainId)
        if (fee.maxManaWei > 0n) {
          step('allowance')
          const allowance = await deps.fetchManaAllowance(address, registry.address)
          if (allowance < fee.maxManaWei) {
            const approveTx = await deps.sendTransaction(
              buildManaApproveCall(chainId, registry.address, fee.maxManaWei)
            )
            if (
              (await settle(approveTx)) === 'dropped' &&
              (await deps.fetchManaAllowance(address, registry.address)) < fee.maxManaWei
            ) {
              throw new LinkedPublishError(
                current,
                'reverted',
                `Transaction ${approveTx} was replaced`,
                undefined,
                approveTx
              )
            }
          }
        }
        if (!registered) {
          step('register')
          txHash = await deps.sendTransaction(buildAddThirdPartyCall(chainId, thirdParty, slotsToBuy, fee.maxManaWei))
          setPayment({ txHash, registration: true })
        } else {
          step('buy_slots')
          txHash = await deps.sendTransaction(buildBuyItemSlotsCall(chainId, thirdParty.id, slotsToBuy, fee.maxManaWei))
          setPayment({ txHash, registration: false })
        }
        step('wait_tx')
        if ((await settle(txHash)) === 'dropped') {
          const after = await deps.fetchSlots()
          if (slotsToBuyFor(after) > 0) {
            throw new LinkedPublishError(current, 'reverted', `Transaction ${txHash} was replaced`, undefined, txHash)
          }
        }
        registered = true
      }

      // A resumed registration still owes the delete, even once the refreshed third party reads as published.
      if ((registered && !params.thirdParty.published) || params.paidTx?.registration) {
        step('delete_virtual')
        try {
          await retry(
            INDEXING_RETRIES,
            INDEXING_RETRY_DELAY_MS,
            () => deps.deleteVirtualThirdParty(thirdParty.id),
            error => hasStatus(error, 400),
            sleep
          )
        } catch (error) {
          // Already gone (e.g. an earlier attempt of this publish removed it).
          if (!hasStatus(error, 404)) throw error
        }
      }

      step('publish')
      published = await publishWithRetry(params, cheque, deps, sleep)
    }

    let pushed: PushLinkedResult | null = null
    if (itemsToPush.length > 0) {
      step('push')
      pushed = await deps.pushChanges(itemsToPush)
    }

    if (payment) deps.onPayment?.(undefined)
    return {
      collection: published?.collection,
      items: published?.items ?? [],
      itemCurations: published?.itemCurations ?? [],
      pushed,
      txHash
    }
  } catch (error) {
    const failure = toLinkedPublishError(error, current, payment)
    // A reverted payment charged nothing, and a pending review means the items went through or can't for now: either
    // way there is nothing left to resume from.
    if (failure.reason === 'reverted' || failure.reason === 'pending_review') deps.onPayment?.(undefined)
    throw failure
  }
}
