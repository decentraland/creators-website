import { type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TranslationProvider } from '~/intl'
import { type CollectionDiscount, type CouponCreation } from '~/lib/coupons'
import { collection, makeSession } from '~/components/CollectionDetailPage/SellItemFlow/testUtils'

vi.mock('~/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('~/lib/auth')>('~/lib/auth')
  return { ...actual, readTransactionOutcome: vi.fn() }
})
vi.mock('~/lib/coupons', async () => {
  const actual = await vi.importActual<typeof import('~/lib/coupons')>('~/lib/coupons')
  return {
    ...actual,
    fetchCreatorDiscounts: vi.fn(),
    createDiscount: vi.fn(),
    endDiscount: vi.fn(),
    storeSignedDiscount: vi.fn()
  }
})
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))

import { readTransactionOutcome } from '~/lib/auth'
import { createDiscount, endDiscount, fetchCreatorDiscounts, storeSignedDiscount } from '~/lib/coupons'
import { savePendingEnd, saveUnconfirmedCreate } from '~/lib/discountAttempts'
import { DiscountFlow } from '~/components/CollectionDetailPage/DiscountFlow/DiscountFlow'
import { EndDiscountFlow } from '~/components/CollectionDetailPage/DiscountFlow/EndDiscountFlow'
import { resetDiscountSession, useCollectionDiscounts } from './useCollectionDiscounts'

const DAY = 24 * 60 * 60 * 1000
const session = makeSession()

const running = {
  id: 'running',
  signer: session.address,
  chainId: 80002,
  collections: [collection.contractAddress],
  discountType: 1,
  discount: 300_000,
  status: 'active',
  checks: { effective: Date.now() - DAY, expiration: Date.now() + DAY, uses: 1_000_000 }
} as unknown as CollectionDiscount

// A fresh client stands in for a reload: nothing in memory, only what the browser kept.
function freshPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>{children}</TranslationProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  resetDiscountSession()
  vi.mocked(readTransactionOutcome).mockReset()
  vi.mocked(fetchCreatorDiscounts).mockReset()
  vi.mocked(endDiscount).mockReset()
  vi.mocked(createDiscount).mockReset()
  vi.mocked(storeSignedDiscount).mockReset()
})

const sendEnd = () =>
  savePendingEnd(session.address, { discountId: 'running', txHash: '0xhash', chainId: 80002, sentAt: Date.now() })

describe('when a cancellation was sent but not seen mined before a reload', () => {
  it('should not offer End again after the reload, sending nothing', () => {
    sendEnd()
    render(<EndDiscountFlow discount={running} collection={collection} session={session} onClose={vi.fn()} />, {
      wrapper: freshPage()
    })

    expect(screen.getByTestId('end-discount-slow-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('end-discount-confirm')).not.toBeInTheDocument()
    expect(endDiscount).not.toHaveBeenCalled()
  })

  // Hidden while it still applies would be wrong; offering End again would pay for a second cancellation.
  it('should keep the discount listed as ending while the chain has no receipt for it', async () => {
    sendEnd()
    vi.mocked(fetchCreatorDiscounts).mockResolvedValue([running])
    vi.mocked(readTransactionOutcome).mockResolvedValue('unknown')

    const { result } = renderHook(() => useCollectionDiscounts(session.address, collection.contractAddress), {
      wrapper: freshPage()
    })

    await waitFor(() =>
      expect(result.current.discounts).toEqual([expect.objectContaining({ id: 'running', ending: true })])
    )
  })

  it('should bring End back once the chain says the cancellation reverted', async () => {
    sendEnd()
    vi.mocked(fetchCreatorDiscounts).mockResolvedValue([running])
    vi.mocked(readTransactionOutcome).mockResolvedValue('reverted')

    const { result } = renderHook(() => useCollectionDiscounts(session.address, collection.contractAddress), {
      wrapper: freshPage()
    })

    await waitFor(() => expect(readTransactionOutcome).toHaveBeenCalled())
    await waitFor(() => expect(result.current.discounts?.[0]?.ending).toBeUndefined())
  })

  it('should take the discount off the list once the chain says the cancellation mined', async () => {
    sendEnd()
    vi.mocked(fetchCreatorDiscounts).mockResolvedValue([running])
    vi.mocked(readTransactionOutcome).mockResolvedValue('mined')

    const { result } = renderHook(() => useCollectionDiscounts(session.address, collection.contractAddress), {
      wrapper: freshPage()
    })

    await waitFor(() => expect(result.current.discounts).toEqual([]))
  })
})

describe('when a signed discount was posted with no readable answer before a reload', () => {
  const payload = {
    signer: session.address,
    chainId: 80002,
    signature: '0xsigned',
    discount: 300_000,
    collections: [collection.contractAddress],
    checks: { effective: Date.now(), expiration: Date.now() + DAY, uses: 1_000_000 }
  } as unknown as CouponCreation

  // A second signature would put a second, independently redeemable coupon on sale.
  it('should settle that same coupon instead of asking for a new signature', async () => {
    saveUnconfirmedCreate(session.address, { collectionId: collection.id, payload, signedAt: Date.now() })
    vi.mocked(storeSignedDiscount).mockResolvedValue({ ...running, id: 'stored' })
    const reach = { discounted: 1, unchanged: 0, example: { credits: 100 } }

    render(
      <DiscountFlow collection={collection} session={session} reach={reach} manaListings={false} onClose={vi.fn()} />,
      {
        wrapper: freshPage()
      }
    )
    expect(screen.queryByTestId('create-discount-form')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('discount-unconfirmed-retry'))

    expect(await screen.findByTestId('success-modal-title')).toHaveTextContent(/your discount is live/i)
    expect(storeSignedDiscount).toHaveBeenCalledWith(payload, expect.anything())
    expect(createDiscount).not.toHaveBeenCalled()
  })
})
