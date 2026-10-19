// The linked-collection publish sequence, ported from the legacy builder's thirdParty sagas
// (handlePublishAndPushChangesThirdPartyItemRequest + Success): record the ToS, buy the missing item slots on the
// ThirdPartyRegistry when needed (registering the third party on its first publish), then hand the signed slots
// cheque to builder-server, which opens one item curation per item, and finally push changes of already-reviewed
// items. Server and chain access is injected so the sequence runs against fakes in tests.
import { ethers } from 'ethers'
import { type ContractCall } from '~/lib/auth'
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
  type ThirdPartyPrice
} from '~/lib/thirdPartyRegistry'
import { isWalletRejection } from '~/lib/walletErrors'

export type LinkedPublishStep =
  'tos' | 'kind' | 'allowance' | 'register' | 'buy_slots' | 'wait_tx' | 'delete_virtual' | 'publish' | 'push'

export type LinkedPublishFailureReason =
  'rejected' | 'reverted' | 'insufficient_slots' | 'pending_review' | 'tos_failed' | 'generic'

export class LinkedPublishError extends Error {
  step: LinkedPublishStep
  reason: LinkedPublishFailureReason
  /** The underlying failure, when this one wraps it. */
  cause?: unknown
  /** The transaction that reverted, for 'reverted'. */
  txHash?: string

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
export function toLinkedPublishError(error: unknown, step: LinkedPublishStep): LinkedPublishError {
  if (error instanceof LinkedPublishError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (step === 'tos') return new LinkedPublishError(step, 'tos_failed', message, error)
  if (isWalletRejection(error)) return new LinkedPublishError(step, 'rejected', message, error)
  if (isInsufficientSlotsError(error)) return new LinkedPublishError(step, 'insufficient_slots', message, error)
  if (isPendingReviewError(error)) return new LinkedPublishError(step, 'pending_review', message, error)
  return new LinkedPublishError(step, 'generic', message, error)
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
 * Slots to buy for this publish. A programmatic third party pays once, on registration, for at least the
 * registry's base pack and never again; a standard one buys whatever its items exceed its free slots by.
 */
export function getSlotsToBuy(params: SlotsToBuyParams): number {
  const missing = Math.max(0, params.itemsToPublish - params.availableSlots)
  if (!params.isProgrammatic) return missing
  return params.isPublished ? 0 : Math.max(missing, params.programmaticMinSlots)
}

export type LinkedPublishFee = {
  usdWei: bigint
  manaWei: bigint
  /** The cap handed to the registry: the MANA price plus the legacy 0.5% pad for oracle drift between quote and tx. */
  maxManaWei: bigint
}

const MAX_PRICE_PAD_NUMERATOR = 1005n
const MAX_PRICE_PAD_DENOMINATOR = 1000n

export function getLinkedPublishFee(slotsToBuy: number, price: ThirdPartyPrice): LinkedPublishFee {
  const slots = BigInt(Math.max(0, slotsToBuy))
  const manaWei = price.itemSlotManaWei * slots
  const padded = manaWei * MAX_PRICE_PAD_NUMERATOR
  const maxManaWei = (padded + MAX_PRICE_PAD_DENOMINATOR - 1n) / MAX_PRICE_PAD_DENOMINATOR
  return { usdWei: price.itemSlotUsdWei * slots, manaWei, maxManaWei }
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
  availableSlots: number
  price: ThirdPartyPrice
}

/** The server and chain calls the sequence needs, so it can run against fakes in tests. */
export type PublishLinkedDeps = {
  saveTOS: (collection: Collection, email: string, hashes: string[]) => Promise<void>
  setThirdPartyKind: (thirdPartyId: string, isProgrammatic: boolean) => Promise<void>
  fetchManaAllowance: (owner: string, spender: string) => Promise<bigint>
  sendTransaction: (call: ContractCall) => Promise<string>
  /** Resolves true when mined, false when reverted. */
  waitForTransaction: (txHash: string) => Promise<boolean>
  deleteVirtualThirdParty: (thirdPartyId: string) => Promise<void>
  publishLinkedItems: (
    collectionId: string,
    itemIds: string[],
    cheque: SlotsCheque
  ) => Promise<PublishLinkedItemsResult>
  pushChanges: (items: Item[]) => Promise<PushLinkedResult>
  onStep?: (step: LinkedPublishStep) => void
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
  let serverFailed = false
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
  const assertMined = async (txHash: string) => {
    if (!(await deps.waitForTransaction(txHash))) {
      throw new LinkedPublishError(current, 'reverted', `Transaction ${txHash} reverted`, undefined, txHash)
    }
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
    let txHash: string | null = null
    let published: PublishLinkedItemsResult | null = null

    if (itemsToPublish.length > 0 && cheque) {
      const isVirtual = !thirdParty.published
      // The kind is only chosen before the first publish; the registry fixes it on registration.
      if (isVirtual && isProgrammatic !== thirdParty.isProgrammatic) {
        step('kind')
        await deps.setThirdPartyKind(thirdParty.id, isProgrammatic)
        thirdParty = { ...thirdParty, isProgrammatic }
      }

      const slotsToBuy = getSlotsToBuy({
        itemsToPublish: itemsToPublish.length,
        availableSlots: params.availableSlots,
        isProgrammatic: thirdParty.isProgrammatic,
        isPublished: thirdParty.published,
        programmaticMinSlots: params.price.programmaticMinSlots
      })

      if (slotsToBuy > 0) {
        const fee = getLinkedPublishFee(slotsToBuy, params.price)
        const registry = getThirdPartyRegistry(chainId)
        step('allowance')
        const allowance = await deps.fetchManaAllowance(address, registry.address)
        if (allowance < fee.maxManaWei) {
          await assertMined(await deps.sendTransaction(buildManaApproveCall(chainId, registry.address, fee.maxManaWei)))
        }
        if (isVirtual) {
          step('register')
          txHash = await deps.sendTransaction(buildAddThirdPartyCall(chainId, thirdParty, slotsToBuy, fee.maxManaWei))
        } else {
          step('buy_slots')
          txHash = await deps.sendTransaction(buildBuyItemSlotsCall(chainId, thirdParty.id, slotsToBuy, fee.maxManaWei))
        }
        step('wait_tx')
        await assertMined(txHash)
      }

      if (isVirtual && txHash) {
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

    return {
      collection: published?.collection,
      items: published?.items ?? [],
      itemCurations: published?.itemCurations ?? [],
      pushed,
      txHash
    }
  } catch (error) {
    throw toLinkedPublishError(error, current)
  }
}
