import { afterEach, describe, expect, it, vi } from 'vitest'
import { type CouponCreation } from '~/lib/coupons'
import {
  clearPendingEnd,
  pendingEndOf,
  resetDiscountAttempts,
  savePendingEnd,
  saveUnconfirmedCreate,
  unconfirmedCreateOf
} from './discountAttempts'

const ADDRESS = '0x00000000000000000000000000000000000000AA'
const NOW = Date.UTC(2026, 9, 16)
const end = { discountId: 'd1', txHash: '0xhash', chainId: 80002, sentAt: NOW }
const payloadEnding = (expiration: number) => ({ checks: { expiration } }) as unknown as CouponCreation

afterEach(() => {
  resetDiscountAttempts()
  vi.restoreAllMocks()
})

describe('when recording a cancellation that was sent', () => {
  // A reload must not forget it, or End would be offered, and paid for, again.
  it('should still have it after a reload', async () => {
    savePendingEnd(ADDRESS, end)
    vi.resetModules()
    const reloaded = await import('./discountAttempts')
    expect(reloaded.pendingEndOf(ADDRESS.toLowerCase(), 'd1')).toEqual(end)
  })

  it('should forget it once it is settled', () => {
    savePendingEnd(ADDRESS, end)
    clearPendingEnd(ADDRESS, 'd1')
    expect(pendingEndOf(ADDRESS, 'd1')).toBeUndefined()
  })

  it('should still hold it for this tab when the browser keeps no site data', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    savePendingEnd(ADDRESS, end)
    expect(pendingEndOf(ADDRESS, 'd1')).toEqual(end)
  })
})

describe('when recording a coupon whose storing is unconfirmed', () => {
  it('should hand it back for a retry while its window is open', () => {
    const create = { collectionId: 'c1', payload: payloadEnding(NOW + 1000), signedAt: NOW }
    saveUnconfirmedCreate(ADDRESS, create)
    expect(unconfirmedCreateOf(ADDRESS, 'c1', NOW)).toEqual(create)
  })

  // Past its window it can apply nowhere, so there is nothing left to settle.
  it('should drop it once its window closed', () => {
    saveUnconfirmedCreate(ADDRESS, { collectionId: 'c1', payload: payloadEnding(NOW), signedAt: NOW - 1000 })
    expect(unconfirmedCreateOf(ADDRESS, 'c1', NOW)).toBeUndefined()
    expect(unconfirmedCreateOf(ADDRESS, 'c1', NOW - 5000)).toBeUndefined()
  })
})
