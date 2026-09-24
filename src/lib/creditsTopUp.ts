// The hand-off across the Stripe redirect. Buying credits leaves the app for Stripe's hosted page,
// which wipes the publish wizard's state; this record is written just before leaving and read once
// on the way back, so the creator lands on the payment step they left, not on a fresh wizard.
import { type PaymentMethod } from './publishCollection'

export type TopUpResume = {
  collectionId: string
  orderId: string
  paymentMethod: PaymentMethod | null
  termsAccepted: boolean
}

export type TopUpReturn = {
  orderId: string
  canceled: boolean
}

const STORAGE_KEY = 'wemotes-builder.credits-top-up'

/** The query Stripe brings back on credits-server's return URL: `?order=<id>` plus `&canceled=1` on cancel. */
export const TOP_UP_ORDER_PARAM = 'order'
export const TOP_UP_CANCELED_PARAM = 'canceled'

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function saveTopUpResume(resume: TopUpResume): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(resume))
}

export function readTopUpResume(): TopUpResume | null {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TopUpResume>
    if (typeof parsed.collectionId !== 'string' || typeof parsed.orderId !== 'string') return null
    return {
      collectionId: parsed.collectionId,
      orderId: parsed.orderId,
      paymentMethod:
        parsed.paymentMethod === 'credits' || parsed.paymentMethod === 'mana' ? parsed.paymentMethod : null,
      termsAccepted: parsed.termsAccepted === true
    }
  } catch {
    return null
  }
}

export function clearTopUpResume(): void {
  storage()?.removeItem(STORAGE_KEY)
}

/** The Stripe return carried by a query string, or null when this is an ordinary visit. */
// Order ids are uuids; anything else in the query is noise, not an order to look up.
const ORDER_ID = /^[\w-]{1,128}$/

export function parseTopUpReturn(params: URLSearchParams): TopUpReturn | null {
  const orderId = params.get(TOP_UP_ORDER_PARAM)
  if (!orderId || !ORDER_ID.test(orderId)) return null
  return { orderId, canceled: params.get(TOP_UP_CANCELED_PARAM) === '1' }
}

/** The same query with the return params removed, so a reload does not replay the return. */
export function stripTopUpReturn(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(TOP_UP_ORDER_PARAM)
  next.delete(TOP_UP_CANCELED_PARAM)
  return next
}
