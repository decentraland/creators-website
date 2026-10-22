// A linked publish whose payment went out but whose run didn't finish, remembered per collection so that closing the
// wizard (or reloading) and coming back resumes it instead of paying a second time.
import { type LinkedPayment } from './publishLinkedItems'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KEY_PREFIX = 'linked-publish.pending-payment.'

function storage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isPayment(value: unknown): value is LinkedPayment {
  if (!value || typeof value !== 'object') return false
  const { txHash, registration } = value as Record<string, unknown>
  return typeof txHash === 'string' && /^0x[0-9a-fA-F]+$/.test(txHash) && typeof registration === 'boolean'
}

export function loadPendingPayment(collectionId: string, store = storage()): LinkedPayment | undefined {
  try {
    const raw = store?.getItem(KEY_PREFIX + collectionId)
    const parsed: unknown = raw ? JSON.parse(raw) : undefined
    return isPayment(parsed) ? { txHash: parsed.txHash, registration: parsed.registration } : undefined
  } catch {
    return undefined
  }
}

/** Stores the payment to resume, or forgets it when there is none left (a finished or reverted one). */
export function savePendingPayment(collectionId: string, payment: LinkedPayment | undefined, store = storage()): void {
  try {
    if (payment) store?.setItem(KEY_PREFIX + collectionId, JSON.stringify(payment))
    else store?.removeItem(KEY_PREFIX + collectionId)
  } catch {
    // Storage blocked: the resume only lives as long as the wizard.
  }
}
