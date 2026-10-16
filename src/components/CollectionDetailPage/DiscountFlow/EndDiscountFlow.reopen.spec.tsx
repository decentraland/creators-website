import { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TranslationProvider } from '~/intl'
import { type CollectionDiscount } from '~/lib/coupons'
import { collection, makeSession } from '../SellItemFlow/testUtils'

vi.mock('~/lib/coupons', async () => {
  const actual = await vi.importActual<typeof import('~/lib/coupons')>('~/lib/coupons')
  return { ...actual, endDiscount: vi.fn() }
})
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))

import { endDiscount } from '~/lib/coupons'
import { EndDiscountFlow } from './EndDiscountFlow'

const DAY = 24 * 60 * 60 * 1000

describe('when the creator closes the End dialog with the wallet prompt still open and opens it again', () => {
  // Each attempt is a paid cancellation: a reopened dialog must never send a second one.
  it('should wait on the first attempt and celebrate once it mines, sending nothing else', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TranslationProvider>{children}</TranslationProvider>
      </QueryClientProvider>
    )
    let mine: () => void = () => {}
    vi.mocked(endDiscount).mockImplementation(
      (_, deps) =>
        new Promise<void>(resolve => {
          mine = () => {
            deps.onSigned?.()
            resolve()
          }
        })
    )
    const session = makeSession()
    const discount = {
      id: 'reopened',
      signer: session.address,
      chainId: 80002,
      collections: [collection.contractAddress],
      discount: 300_000,
      checks: { effective: Date.now() - DAY, expiration: Date.now() + DAY, uses: 1_000_000 }
    } as unknown as CollectionDiscount
    const flow = () => (
      <EndDiscountFlow discount={discount} collection={collection} session={session} onClose={vi.fn()} />
    )

    const first = render(flow(), { wrapper })
    await userEvent.click(screen.getByTestId('end-discount-confirm'))
    await userEvent.click(screen.getByTestId('end-discount-pending-cancel'))
    first.unmount()

    render(flow(), { wrapper })
    expect(screen.getByTestId('end-discount-in-flight')).toBeInTheDocument()
    expect(screen.queryByTestId('end-discount-confirm')).not.toBeInTheDocument()

    await act(async () => mine())
    expect(await screen.findByTestId('success-modal-title')).toHaveTextContent(/discount ended/i)
    expect(screen.queryByTestId('end-discount-confirm')).not.toBeInTheDocument()
    expect(endDiscount).toHaveBeenCalledTimes(1)
  })
})
