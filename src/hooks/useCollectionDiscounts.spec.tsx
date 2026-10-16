import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type CollectionDiscount } from '~/lib/coupons'
import { Providers, collection, makeSession } from '~/components/CollectionDetailPage/SellItemFlow/testUtils'

vi.mock('~/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('~/lib/auth')>('~/lib/auth')
  return { ...actual, sendWalletTransaction: vi.fn(), waitForTransaction: vi.fn() }
})

import { sendWalletTransaction } from '~/lib/auth'
import { useEndDiscount } from './useCollectionDiscounts'

describe('when ending a discount', () => {
  // Cancellations are keyed by the caller: anyone else's cancellation leaves the coupon redeemable.
  it('should refuse a discount another account signed, sending nothing', async () => {
    const { result } = renderHook(() => useEndDiscount(makeSession()), { wrapper: Providers })
    const discount = { id: 'c1', signer: '0x00000000000000000000000000000000000000bb' } as CollectionDiscount

    await expect(result.current.mutateAsync({ discount, collection })).rejects.toThrow(/signed by/)
    expect(sendWalletTransaction).not.toHaveBeenCalled()
  })
})
