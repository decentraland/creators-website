import { type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TranslationProvider } from '~/intl'
import { type CollectionDiscount } from '~/lib/coupons'
import { collection, makeSession } from '../SellItemFlow/testUtils'

vi.mock('~/lib/coupons', async () => {
  const actual = await vi.importActual<typeof import('~/lib/coupons')>('~/lib/coupons')
  return { ...actual, endDiscount: vi.fn(), createDiscount: vi.fn() }
})
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))

import { DiscountError, createDiscount, endDiscount } from '~/lib/coupons'
import { resetDiscountSession } from '~/hooks/useCollectionDiscounts'
import { DiscountFlow } from './DiscountFlow'
import { EndDiscountFlow } from './EndDiscountFlow'

const DAY = 24 * 60 * 60 * 1000

afterEach(() => {
  resetDiscountSession()
  vi.mocked(endDiscount).mockReset()
  vi.mocked(createDiscount).mockReset()
})

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>{children}</TranslationProvider>
    </QueryClientProvider>
  )
  return { wrapper, session: makeSession() }
}

function discountOf(id: string, signer: string) {
  return {
    id,
    signer,
    chainId: 80002,
    collections: [collection.contractAddress],
    discount: 300_000,
    checks: { effective: Date.now() - DAY, expiration: Date.now() + DAY, uses: 1_000_000 }
  } as unknown as CollectionDiscount
}

describe('when the creator closes the End dialog with the wallet prompt still open and opens it again', () => {
  // Each attempt is a paid cancellation: a reopened dialog must never send a second one.
  it('should wait on the first attempt and celebrate once it mines, sending nothing else', async () => {
    const { wrapper } = setup()
    let mine: () => void = () => {}
    vi.mocked(endDiscount).mockImplementation(
      (_, deps) =>
        new Promise<void>(resolve => {
          deps.onBroadcast?.('0xhash', 3)
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

  it('should show the cancellation is still mining once the first attempt ran out of time, sending nothing else', async () => {
    const { wrapper, session } = setup()
    let settle: (error: unknown) => void = () => {}
    vi.mocked(endDiscount).mockImplementation(
      (_, deps) =>
        new Promise<void>((_, reject) => {
          deps.onBroadcast?.('0xhash')
          settle = reject
        })
    )
    const discount = discountOf('slow', session.address)
    const flow = () => (
      <EndDiscountFlow discount={discount} collection={collection} session={session} onClose={vi.fn()} />
    )

    const first = render(flow(), { wrapper })
    await userEvent.click(screen.getByTestId('end-discount-confirm'))
    await userEvent.click(screen.getByTestId('end-discount-pending-cancel'))
    first.unmount()
    render(flow(), { wrapper })

    await act(async () => settle(new DiscountError('pending')))
    expect(await screen.findByTestId('end-discount-slow-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('end-discount-confirm')).not.toBeInTheDocument()
    expect(endDiscount).toHaveBeenCalledTimes(1)
  })
})

describe('when the creator closes the Create dialog mid-signature and opens it again', () => {
  // Otherwise the reopened form would let them sign an overlapping second discount without knowing.
  it('should show the first discount went through once it does', async () => {
    const { wrapper, session } = setup()
    let store: () => void = () => {}
    vi.mocked(createDiscount).mockImplementation(
      () => new Promise(resolve => (store = () => resolve(discountOf('created', session.address))))
    )
    const reach = { discounted: 2, unchanged: 0, example: { credits: 100 } }
    const flow = () => (
      <DiscountFlow collection={collection} session={session} reach={reach} manaListings={false} onClose={vi.fn()} />
    )

    const first = render(flow(), { wrapper })
    await userEvent.click(screen.getByTestId('discount-submit'))
    await userEvent.click(screen.getByTestId('create-discount-pending-cancel'))
    first.unmount()
    render(flow(), { wrapper })
    expect(screen.getByTestId('create-discount-in-flight')).toBeInTheDocument()
    expect(screen.queryByTestId('discount-submit')).not.toBeInTheDocument()

    await act(async () => store())
    expect(await screen.findByTestId('success-modal-title')).toHaveTextContent(/your discount is live/i)
    expect(createDiscount).toHaveBeenCalledTimes(1)
  })

  // Jarvis' path: the creator backs out of the prompt, approves it anyway, and its POST gets no answer.
  it('should not let a second coupon be signed next to one backed out of and left unconfirmed', async () => {
    const { wrapper, session } = setup()
    let fail: () => void = () => {}
    vi.mocked(createDiscount).mockImplementation(
      (_, deps) =>
        new Promise((_, reject) => {
          fail = () => {
            deps.onSignedPayload?.({
              signer: session.address,
              chainId: 80002,
              signature: '0xfirst',
              discount: 300_000,
              collections: [collection.contractAddress!],
              checks: { effective: Date.now(), expiration: Date.now() + DAY, uses: 1_000_000 }
            } as never)
            reject(new DiscountError('unconfirmed', 'no answer'))
          }
        })
    )
    const reach = { discounted: 2, unchanged: 0, example: { credits: 100 } }
    render(
      <DiscountFlow collection={collection} session={session} reach={reach} manaListings={false} onClose={vi.fn()} />,
      {
        wrapper
      }
    )

    await userEvent.click(screen.getByTestId('discount-submit'))
    await userEvent.click(screen.getByTestId('create-discount-pending-cancel'))
    await act(async () => fail())

    expect(await screen.findByTestId('discount-unconfirmed-modal')).toBeInTheDocument()
    expect(screen.getByTestId('discount-unconfirmed-terms')).toHaveTextContent('30%')
    expect(screen.queryByTestId('discount-submit')).not.toBeInTheDocument()
    expect(createDiscount).toHaveBeenCalledTimes(1)
  })
})
