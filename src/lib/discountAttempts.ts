// Discount attempts whose outcome this tab could not confirm, kept across reloads. Each one is a step the creator
// already paid for or signed: a cancellation that was broadcast but not seen mined, or a coupon that was signed
// but whose POST got no readable answer. Offering the action again before reconciling it would pay for a second
// cancellation or put a second, independently redeemable coupon on sale.
import { type CouponCreation } from '~/lib/coupons'

export type PendingEnd = { discountId: string; txHash: string; chainId: number; sentAt: number }
export type UnconfirmedCreate = { collectionId: string; payload: CouponCreation; signedAt: number }
type Attempts = { ends: PendingEnd[]; creates: UnconfirmedCreate[] }

const STORAGE_PREFIX = 'collection-discount-attempts:'
// Without storage (private mode, blocked site data) the attempts still hold for this tab.
const memory = new Map<string, Attempts>()

const keyOf = (address: string) => `${STORAGE_PREFIX}${address.toLowerCase()}`

function read(address: string): Attempts {
  const key = keyOf(address)
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Attempts>
      return { ends: parsed.ends ?? [], creates: parsed.creates ?? [] }
    }
  } catch {
    // Unreadable storage falls back to this tab's copy.
  }
  return memory.get(key) ?? { ends: [], creates: [] }
}

function write(address: string, attempts: Attempts): void {
  const key = keyOf(address)
  memory.set(key, attempts)
  try {
    if (attempts.ends.length === 0 && attempts.creates.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(attempts))
  } catch {
    // The in-memory copy still covers this tab.
  }
}

export function pendingEnds(address: string): PendingEnd[] {
  return read(address).ends
}

export function pendingEndOf(address: string, discountId: string): PendingEnd | undefined {
  return read(address).ends.find(end => end.discountId === discountId)
}

export function savePendingEnd(address: string, end: PendingEnd): void {
  const attempts = read(address)
  write(address, { ...attempts, ends: [...attempts.ends.filter(e => e.discountId !== end.discountId), end] })
}

export function clearPendingEnd(address: string, discountId: string): void {
  const attempts = read(address)
  write(address, { ...attempts, ends: attempts.ends.filter(end => end.discountId !== discountId) })
}

/** The coupon signed for the collection whose storing is unconfirmed, unless its window already closed. */
export function unconfirmedCreateOf(
  address: string,
  collectionId: string,
  now = Date.now()
): UnconfirmedCreate | undefined {
  const create = read(address).creates.find(entry => entry.collectionId === collectionId)
  if (create && create.payload.checks.expiration <= now) {
    clearUnconfirmedCreate(address, collectionId)
    return undefined
  }
  return create
}

export function saveUnconfirmedCreate(address: string, create: UnconfirmedCreate): void {
  const attempts = read(address)
  write(address, {
    ...attempts,
    creates: [...attempts.creates.filter(c => c.collectionId !== create.collectionId), create]
  })
}

export function clearUnconfirmedCreate(address: string, collectionId: string): void {
  const attempts = read(address)
  write(address, { ...attempts, creates: attempts.creates.filter(create => create.collectionId !== collectionId) })
}

/** Forgets everything; for specs. */
export function resetDiscountAttempts(): void {
  memory.clear()
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key)
  } catch {
    // Nothing stored.
  }
}
