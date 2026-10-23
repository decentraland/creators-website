// The payment an unfinished linked publish sent, remembered per chain, wallet and collection so that closing the
// wizard (or reloading) and coming back resumes it instead of paying a second time.
import { type SentRoot } from './approveLinkedCollection'
import { type LinkedPayment } from './publishLinkedItems'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type PendingPublishScope = { chainId: number; address: string; collectionId: string }

export type PendingPublish = {
  /** A registration or slot purchase sent and not yet known to be consumed. */
  payment?: LinkedPayment
}

const KEY_PREFIX = 'linked-publish.pending.'

const keyOf = ({ chainId, address, collectionId }: PendingPublishScope) =>
  `${KEY_PREFIX}${chainId}.${address.toLowerCase()}.${collectionId}`

function storage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function toPayment(value: unknown): LinkedPayment | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { txHash, registration, sender } = value as Record<string, unknown>
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]+$/.test(txHash) || typeof registration !== 'boolean') {
    return undefined
  }
  const { from, nonce } = (sender ?? {}) as Record<string, unknown>
  const validSender =
    typeof from === 'string' && /^0x[0-9a-fA-F]{40}$/.test(from) && typeof nonce === 'number' && Number.isInteger(nonce)
  return { txHash, registration, ...(validSender ? { sender: { from, nonce } } : {}) }
}

export function loadPendingPublish(scope: PendingPublishScope, store = storage()): PendingPublish {
  try {
    const raw = store?.getItem(keyOf(scope))
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined
    if (!parsed || typeof parsed !== 'object') return {}
    const payment = toPayment(parsed.payment)
    return payment ? { payment } : {}
  } catch {
    return {}
  }
}

/** Stores what is left to resume, or forgets it once nothing is. */
export function savePendingPublish(scope: PendingPublishScope, pending: PendingPublish, store = storage()): void {
  try {
    if (pending.payment) store?.setItem(keyOf(scope), JSON.stringify(pending))
    else store?.removeItem(keyOf(scope))
  } catch {
    // Storage blocked: the resume only lives as long as the wizard.
  }
}

export type SentRootScope = { chainId: number; thirdPartyId: string }

const ROOT_KEY_PREFIX = 'linked-approval.root.'

const rootKeyOf = ({ chainId, thirdPartyId }: SentRootScope) => `${ROOT_KEY_PREFIX}${chainId}.${thirdPartyId}`

/**
 * The root transaction a curator sent and hasn't seen settle, per third party: closing the approval (or reloading)
 * and approving again then waits on it instead of spending the cheque twice.
 */
export function loadSentRoot(scope: SentRootScope, store = storage()): SentRoot | undefined {
  try {
    const raw = store?.getItem(rootKeyOf(scope))
    const { hash, merkleRoot } = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>
    const isHex = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)
    return isHex(hash) && isHex(merkleRoot) ? { hash, merkleRoot } : undefined
  } catch {
    return undefined
  }
}

export function saveSentRoot(scope: SentRootScope, sent: SentRoot | undefined, store = storage()): void {
  try {
    if (sent) store?.setItem(rootKeyOf(scope), JSON.stringify(sent))
    else store?.removeItem(rootKeyOf(scope))
  } catch {
    // Storage blocked: the root is only remembered while the dialog is open.
  }
}
