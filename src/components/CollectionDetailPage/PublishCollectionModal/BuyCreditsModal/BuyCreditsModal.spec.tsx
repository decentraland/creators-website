import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuyCreditsModal } from './BuyCreditsModal'
import { Providers } from '../../SellItemFlow/testUtils'

// The bundled catalogue stands in: the picker must work before, or without, the fetch.
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))

function renderModal(props: Partial<React.ComponentProps<typeof BuyCreditsModal>> = {}) {
  const onBuy = vi.fn<(selection: { packId: string; quantity: number }) => Promise<void>>().mockResolvedValue()
  const onCancel = vi.fn()
  render(<BuyCreditsModal balance={60} shortfall={240} onCancel={onCancel} onBuy={onBuy} {...props} />, {
    wrapper: Providers
  })
  return { onBuy, onCancel }
}

describe('BuyCreditsModal', () => {
  it('preselects and badges the cheapest pack that covers the shortfall, with its total', () => {
    renderModal()
    expect(screen.getByTestId('credit-pack-pack_25')).toHaveAttribute('data-selected')
    expect(screen.getByTestId('credit-pack-pack_25')).toContainElement(screen.getByTestId('credit-pack-recommended'))
    expect(screen.getByTestId('credit-pack-pack_25-quantity')).toHaveTextContent('1')
    expect(screen.getByTestId('buy-credits-total-usd')).toHaveTextContent('$29.99')
    expect(screen.getByTestId('buy-credits-submit')).toHaveTextContent('Buy 260 Credits')
    expect(screen.getByTestId('buy-credits-balance')).toHaveTextContent('60')
  })

  it('preselects several of the largest pack when no single pack is enough', () => {
    renderModal({ shortfall: 1000 })
    expect(screen.getByTestId('credit-pack-pack_50-quantity')).toHaveTextContent('2')
    expect(screen.getByTestId('buy-credits-total-usd')).toHaveTextContent('$119.98')
    expect(screen.getByTestId('buy-credits-submit')).toHaveTextContent('Buy 1,080 Credits')
  })

  it('only ever buys copies of one pack: choosing another resets the first', async () => {
    renderModal()
    await userEvent.click(screen.getByTestId('credit-pack-pack_50-increase'))
    expect(screen.getByTestId('credit-pack-pack_50-quantity')).toHaveTextContent('1')
    expect(screen.getByTestId('credit-pack-pack_25-quantity')).toHaveTextContent('0')
    expect(screen.getByTestId('credit-pack-pack_25')).not.toHaveAttribute('data-selected')

    await userEvent.click(screen.getByTestId('credit-pack-pack_50-increase'))
    expect(screen.getByTestId('credit-pack-pack_50-quantity')).toHaveTextContent('2')
    expect(screen.getByTestId('buy-credits-submit')).toHaveTextContent('Buy 1,080 Credits')
    expect(screen.getByTestId('buy-credits-total-usd')).toHaveTextContent('$119.98')
  })

  it('disables buying once every pack is back to zero', async () => {
    renderModal()
    await userEvent.click(screen.getByTestId('credit-pack-pack_25-decrease'))
    expect(screen.getByTestId('credit-pack-pack_25-quantity')).toHaveTextContent('0')
    expect(screen.getByTestId('buy-credits-submit')).toBeDisabled()
    expect(screen.getByTestId('credit-pack-pack_25-decrease')).toBeDisabled()
  })

  it('hands the chosen pack and quantity to the checkout', async () => {
    const { onBuy } = renderModal({ shortfall: 1000 })
    await userEvent.click(screen.getByTestId('buy-credits-submit'))
    expect(onBuy).toHaveBeenCalledWith({ packId: 'pack_50', quantity: 2 })
  })

  it('keeps the dialog open with an error when the checkout cannot start', async () => {
    const { onBuy } = renderModal()
    onBuy.mockRejectedValue(new Error('down'))
    await userEvent.click(screen.getByTestId('buy-credits-submit'))
    expect(await screen.findByTestId('buy-credits-error')).toBeInTheDocument()
    expect(screen.getByTestId('buy-credits-submit')).toBeEnabled()
  })

  it('can be dismissed', async () => {
    const { onCancel } = renderModal()
    await userEvent.click(screen.getByTestId('buy-credits-cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
