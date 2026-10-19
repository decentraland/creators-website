import { type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TranslationProvider } from '~/intl'
import { type CollectionDiscount } from '~/lib/coupons'
import { type SaleableCollection } from '~/lib/saleableCollection'
import { collection, makeSession } from '../SellItemFlow/testUtils'

vi.mock('~/lib/coupons', async () => {
  const actual = await vi.importActual<typeof import('~/lib/coupons')>('~/lib/coupons')
  return { ...actual, endDiscount: vi.fn(), createDiscount: vi.fn() }
})
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))
vi.mock('~/components/CollectionMosaic', () => ({ CollectionMosaic: () => null }))

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

const sale: SaleableCollection = {
  contractAddress: collection.contractAddress!,
  collectionId: collection.id,
  itemCount: 1,
  name: collection.name,
  listedCount: 1,
  items: [{ key: 'k1', name: 'Pirate Hat', thumbnail: '', priceCredits: 100, state: 'discounted', remainingSupply: 9 }]
}

describe('when the create dialog goes away mid-signature and opens again', () => {
  // Otherwise the reopened form would let them sign an overlapping second discount without knowing.
  it('should wait on the first create and show it went through once it does', async () => {
    const { wrapper, session } = setup()
    let store: () => void = () => {}
    vi.mocked(createDiscount).mockImplementation(
      () => new Promise(resolve => (store = () => resolve(discountOf('created', session.address))))
    )
    const flow = () => <DiscountFlow collection={collection} session={session} sale={sale} onClose={vi.fn()} />

    const first = render(flow(), { wrapper })
    await userEvent.click(screen.getByTestId('creator-sale-continue'))
    await userEvent.click(screen.getByTestId('creator-sale-submit'))
    first.unmount()
    render(flow(), { wrapper })
    expect(screen.getByTestId('create-discount-in-flight')).toBeInTheDocument()
    expect(screen.queryByTestId('creator-sale-modal')).not.toBeInTheDocument()

    await act(async () => store())
    expect(await screen.findByTestId('success-modal-title')).toHaveTextContent(/your discount is live/i)
    expect(createDiscount).toHaveBeenCalledTimes(1)
  })

  // The coupon was signed and its POST got no answer: only that coupon may be retried, never a new one.
  it('should go to settling the signed coupon, with its terms, and not offer a new signature', async () => {
    const { wrapper, session } = setup()
    vi.mocked(createDiscount).mockImplementation(async (_, deps) => {
      deps.onSignedPayload?.({
        signer: session.address,
        chainId: 80002,
        signature: '0xfirst',
        discount: 300_000,
        collections: [collection.contractAddress!],
        checks: { effective: Date.now(), expiration: Date.now() + DAY, uses: 1_000_000 }
      } as never)
      throw new DiscountError('unconfirmed', 'no answer')
    })
    render(<DiscountFlow collection={collection} session={session} sale={sale} onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByTestId('creator-sale-pct-30'))
    await userEvent.click(screen.getByTestId('creator-sale-continue'))
    await userEvent.click(screen.getByTestId('creator-sale-submit'))

    expect(await screen.findByTestId('discount-unconfirmed-modal')).toBeInTheDocument()
    expect(screen.getByTestId('discount-unconfirmed-terms')).toHaveTextContent('30%')
    expect(screen.queryByTestId('creator-sale-modal')).not.toBeInTheDocument()
    expect(createDiscount).toHaveBeenCalledTimes(1)
  })
})

describe('when the creator creates a discount while the page watches the discounts list', () => {
  // The flow's own create must end on the modal's success, never on a fresh form a second signature could follow.
  it("should land on the modal's success view", async () => {
    const { wrapper, session } = setup()
    vi.mocked(createDiscount).mockResolvedValue(discountOf('created', session.address))
    render(<DiscountFlow collection={collection} session={session} sale={sale} onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByTestId('creator-sale-continue'))
    await userEvent.click(screen.getByTestId('creator-sale-submit'))

    expect(await screen.findByTestId('creator-sale-success')).toBeInTheDocument()
    expect(screen.queryByTestId('creator-sale-modal')).not.toBeInTheDocument()
    expect(createDiscount).toHaveBeenCalledTimes(1)
  })
})
