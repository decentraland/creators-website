import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProviderType } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { DiscountError, type CollectionDiscount } from '~/lib/coupons'
import { type SaleableCollection } from '~/lib/saleableCollection'
import { makeSession } from '../SellItemFlow/testUtils'

const track = vi.fn()
vi.mock('~/lib/analytics', () => ({ track: (...args: unknown[]) => track(...args), errorCode: () => 'unknown' }))
const openExternal = vi.fn()
vi.mock('~/lib/navigation', () => ({ openExternal: (url: string) => openExternal(url) }))
vi.mock('~/components/CollectionMosaic', () => ({ CollectionMosaic: () => null }))

import { CreatorSaleModal } from './CreatorSaleModal'

const HOUR = 60 * 60 * 1000

const collection: SaleableCollection = {
  contractAddress: '0x' + 'aa'.repeat(20),
  collectionId: 'c1',
  itemCount: 2,
  name: 'Galaxy Drip',
  listedCount: 1,
  items: [
    { key: 'k1', name: 'Galaxy Hat', thumbnail: '', priceCredits: 100, state: 'discounted', remainingSupply: 9 },
    { key: 'k2', name: 'Classic Boots', thumbnail: '', priceCredits: null, state: 'classic', remainingSupply: 3 }
  ]
}

const blocked: SaleableCollection = { ...collection, listedCount: 0, items: [collection.items[1]] }

function open(
  props: {
    of?: SaleableCollection
    onSubmit?: (...args: unknown[]) => Promise<CollectionDiscount>
    onUnconfirmed?: () => void
    onClose?: () => void
    social?: boolean
    strict?: boolean
  } = {}
) {
  const onSubmit = props.onSubmit ?? vi.fn(() => new Promise<CollectionDiscount>(() => {}))
  const onClose = props.onClose ?? vi.fn()
  const onUnconfirmed = props.onUnconfirmed ?? vi.fn()
  const Wrap = props.strict ? StrictMode : 'div'
  render(
    <Wrap>
      <QueryClientProvider client={new QueryClient()}>
        <TranslationProvider>
          <CreatorSaleModal
            session={makeSession(props.social ? ProviderType.MAGIC : ProviderType.INJECTED)}
            collection={props.of ?? collection}
            onSubmit={onSubmit}
            onUnconfirmed={onUnconfirmed}
            onClose={onClose}
          />
        </TranslationProvider>
      </QueryClientProvider>
    </Wrap>
  )
  return { onSubmit, onClose, onUnconfirmed }
}

const live = {
  id: 'd1',
  status: 'active',
  collections: ['0xaa'],
  discount: 200_000,
  checks: { expiration: Date.now() + 72 * HOUR, effective: Date.now() }
} as unknown as CollectionDiscount

beforeEach(() => {
  track.mockReset()
  openExternal.mockReset()
})

describe('when a creator discounts a collection from the builder', () => {
  it('should offer the Shop presets, preview what buyers pay and sign the reviewed terms', async () => {
    const { onSubmit } = open({ onSubmit: vi.fn().mockResolvedValue(live) })
    expect(screen.getByTestId('creator-sale-collections')).toHaveTextContent('Galaxy Drip')
    fireEvent.click(screen.getByTestId('creator-sale-pct-30'))
    expect(screen.getByTestId('creator-sale-preview-now')).toHaveTextContent('70')
    expect(screen.getByTestId('creator-sale-preview-was')).toHaveTextContent('100')

    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    expect(screen.getByTestId('creator-sale-review-items')).toHaveTextContent('Galaxy Hat')
    expect(screen.getByTestId('creator-sale-review-classic')).toHaveTextContent('Classic Boots')
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))

    const [terms] = vi.mocked(onSubmit).mock.calls[0] as [
      { discountPct: number; endsAtMs: number; startsAtMs?: number; uses?: number }
    ]
    expect(terms).toMatchObject({ discountPct: 30, startsAtMs: undefined, uses: undefined })
    expect(terms.endsAtMs).toBeGreaterThan(Date.now() + 71 * HOUR)
    expect(screen.getByTestId('creator-sale-success')).toBeInTheDocument()
  })

  it('should send the creator to their store in the Shop once it is live', async () => {
    open({ onSubmit: vi.fn().mockResolvedValue(live) })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    fireEvent.click(screen.getByText('View your store'))
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining('/shop/items/creator/0x'))
  })

  it('should cap the copies at what is listed', () => {
    open()
    fireEvent.change(screen.getByTestId('creator-sale-cap'), { target: { value: '50' } })
    expect(screen.getByTestId('creator-sale-cap-count')).toHaveTextContent('9/9')
  })

  it('should hold back a custom discount out of range', () => {
    open()
    fireEvent.click(screen.getByTestId('creator-sale-custom-pct-chip'))
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '90' } })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    expect(screen.getByTestId('creator-sale-error')).toHaveTextContent('between 5% and 70%')
    expect(screen.queryByTestId('creator-sale-review')).not.toBeInTheDocument()
  })

  it('should stay on the review without an error when the creator dismisses the wallet', async () => {
    open({ onSubmit: vi.fn().mockRejectedValue(new DiscountError('rejected')) })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    expect(screen.getByTestId('creator-sale-review')).toBeInTheDocument()
    expect(screen.queryByTestId('creator-sale-error')).not.toBeInTheDocument()
  })

  // Only that same signed coupon may be retried: the flow around the modal settles it.
  it('should hand over a coupon whose storing got no answer', async () => {
    const { onUnconfirmed } = open({ onSubmit: vi.fn().mockRejectedValue(new DiscountError('unconfirmed')) })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    expect(onUnconfirmed).toHaveBeenCalled()
  })

  it('should explain a wallet on another account or network', async () => {
    open({ onSubmit: vi.fn().mockRejectedValue(new DiscountError('wallet')) })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    expect(screen.getByTestId('creator-sale-error')).toHaveTextContent(/another account or network/)
  })

  it('should say why nothing can take a discount, and close on its action', () => {
    const { onClose } = open({ of: blocked })
    expect(screen.getByTestId('creator-sale-blocked')).toHaveTextContent(/Credits/)
    fireEvent.click(screen.getByText('Update prices'))
    expect(onClose).toHaveBeenCalled()
  })

  it('should record reaching the review and leaving without a discount', () => {
    const { onClose } = open()
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    expect(track).toHaveBeenCalledWith(
      'Review collection discount',
      expect.objectContaining({ collectionId: 'c1', discountPct: 20, durationDays: 3, capped: false })
    )
    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(track).toHaveBeenCalledWith('Abandon collection discount', {
      collectionId: 'c1',
      lastStep: 'review',
      reason: 'closed'
    })
    expect(onClose).toHaveBeenCalled()
  })

  // A dropped WalletConnect session never answers: the creator has to be able to walk away from it.
  it('should let a wallet creator close while the wallet prompt is still open', async () => {
    const { onClose } = open()
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    expect(screen.getByLabelText('Cancel')).toBeEnabled()
    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('should hold a social-login creator in place while their signature is stored', async () => {
    open({ social: true })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    expect(screen.getByLabelText('Cancel')).toBeDisabled()
  })

  it('should close on Escape', () => {
    const { onClose } = open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('should count reaching the review once, however often the creator goes back', () => {
    open()
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    fireEvent.click(screen.getByTestId('creator-sale-back'))
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    expect(track.mock.calls.filter(([event]) => event === 'Review collection discount')).toHaveLength(1)
  })

  it('should take keyboard focus, keep Tab inside it and hand focus back when it closes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { onClose } = open()
    const dialog = screen.getByTestId('creator-sale-modal')
    expect(dialog).toHaveFocus()

    const continueButton = screen.getByTestId('creator-sale-continue')
    continueButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(opener)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    opener.remove()
  })

  // The discount may still be created once the open prompt is signed: closing then is not a drop-off.
  it('should not count closing with the wallet prompt open as leaving without a discount', async () => {
    open()
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(track.mock.calls.filter(([event]) => event === 'Abandon collection discount')).toHaveLength(0)
  })

  // StrictMode mounts twice in development: the success has to show there too, not leave the review signable.
  it('should reach the success view under StrictMode', async () => {
    open({ strict: true, onSubmit: vi.fn().mockResolvedValue(live) })
    fireEvent.click(screen.getByTestId('creator-sale-continue'))
    await act(async () => fireEvent.click(screen.getByTestId('creator-sale-submit')))
    expect(screen.getByTestId('creator-sale-success')).toBeInTheDocument()
  })

  // With reduced motion (or a long press) the calendar is already folded when the click lands on the backdrop.
  it('should only fold the calendar on a backdrop click that started with it open', async () => {
    const matchMedia = window.matchMedia
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }) as unknown as MediaQueryList
    const { onClose } = open()
    fireEvent.click(screen.getByTestId('creator-sale-when'))
    const scrim = screen.getByTestId('creator-sale-modal').parentElement!
    await act(async () => {
      fireEvent.pointerDown(scrim)
      fireEvent.mouseDown(scrim)
    })
    fireEvent.click(scrim)
    expect(onClose).not.toHaveBeenCalled()
    window.matchMedia = matchMedia
  })
})
