import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderType } from '@dcl/schemas'
import { type ItemListing } from '~/lib/listings'
import { NO_EXPIRATION } from '~/lib/sales'
import { UpdatePriceFlow } from './UpdatePriceFlow'
import { ADDRESS, Providers, collection, item, makeSession } from './testUtils'

type Callbacks = { onSuccess?: (result: unknown) => void; onError?: (error: unknown) => void }
type UpdateVariables = {
  credits: number
  onSigned?: (step: 'cancel' | 'sign') => void
  onCancelled?: (terms: unknown) => void
}
type SellVariables = { onSigned?: () => void }
const update = { mutate: vi.fn<(variables: UpdateVariables, callbacks: Callbacks) => void>(), isPending: false }
const sell = { mutate: vi.fn<(variables: SellVariables, callbacks: Callbacks) => void>(), isPending: false }
vi.mock('~/hooks/useSales', () => ({ useUpdatePrice: () => update, useSellItem: () => sell }))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

const listing: ItemListing & { tradeId: string } = { itemId: '3', tradeId: 'trade-1', currency: 'credits', credits: 50 }
const last = <T,>(mock: { mock: { calls: T[] } }) => mock.mock.calls[mock.mock.calls.length - 1]

function renderFlow(providerType = ProviderType.INJECTED) {
  const onClose = vi.fn()
  render(
    <UpdatePriceFlow
      item={item}
      collection={collection}
      listing={listing}
      session={makeSession(providerType)}
      onClose={onClose}
    />,
    { wrapper: Providers }
  )
  return { onClose }
}

async function submitPrice(credits: string) {
  await userEvent.clear(screen.getByTestId('update-price-input'))
  await userEvent.type(screen.getByTestId('update-price-input'), credits)
  await userEvent.click(screen.getByTestId('update-price-submit'))
}

beforeEach(() => {
  update.mutate.mockReset()
  sell.mutate.mockReset()
})

describe('UpdatePriceFlow', () => {
  it('only accepts a new whole-credit price and shows the remaining supply', async () => {
    renderFlow()
    expect(screen.getByTestId('sell-item-availability')).toHaveTextContent('90 / 100 available')
    const submit = screen.getByTestId('update-price-submit')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByTestId('update-price-input'), '50')
    expect(submit).toBeDisabled()
    await userEvent.clear(screen.getByTestId('update-price-input'))
    await userEvent.type(screen.getByTestId('update-price-input'), '8a0')
    expect(screen.getByTestId('update-price-usd')).toHaveTextContent('$8.00')
    expect(submit).toBeEnabled()
    await userEvent.type(screen.getByTestId('update-price-input'), '000000000000')
    expect(screen.getByTestId('update-price-error')).toBeInTheDocument()
    expect(submit).toBeDisabled()
  })

  it('walks a web3 wallet through both signatures, then stores the new order', async () => {
    const { onClose } = renderFlow()
    await submitPrice('80')
    expect(last(update.mutate)[0]).toMatchObject({ credits: 80 })
    expect(screen.getByTestId('update-price-signing-step-1')).toHaveAttribute('data-state', 'current')
    expect(screen.getByTestId('update-price-signing-label')).toHaveTextContent(/removal of your current price/i)
    expect(screen.getByTestId('update-price-signing-cancel')).toBeInTheDocument()

    await act(async () => last(update.mutate)[0].onSigned?.('cancel'))
    expect(screen.getByTestId('update-price-signing-step-1')).toHaveAttribute('data-state', 'done')
    expect(screen.getByTestId('update-price-signing-step-2')).toHaveAttribute('data-state', 'current')
    expect(screen.getByTestId('update-price-signing-label')).toHaveTextContent(/confirm your new price/i)
    expect(screen.queryByTestId('update-price-signing-cancel')).not.toBeInTheDocument()

    await act(async () => last(update.mutate)[0].onSigned?.('sign'))
    expect(screen.getByTestId('update-price-pending-label')).toHaveTextContent(/updating price/i)

    await act(async () => last(update.mutate)[1].onSuccess?.({}))
    expect(screen.getByTestId('sale-success-description')).toHaveTextContent(/new price/i)
    await userEvent.click(screen.getByTestId('sale-success-done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('backs out of the first prompt to the form, and re-lists directly on retry once the old order is gone', async () => {
    renderFlow()
    await submitPrice('80')
    await userEvent.click(screen.getByTestId('update-price-signing-cancel'))
    expect(screen.getByTestId('update-price-input')).toHaveValue('80')

    await userEvent.click(screen.getByTestId('update-price-submit'))
    await act(async () => last(update.mutate)[0].onSigned?.('cancel'))
    await act(async () => last(update.mutate)[0].onCancelled?.({ beneficiary: ADDRESS, expiresAt: NO_EXPIRATION }))
    await act(async () => last(update.mutate)[1].onError?.({ code: 4001, message: 'User rejected' }))
    // The listing is already cancelled: even a dismissed prompt is reported.
    expect(screen.getByTestId('sale-error-modal-title')).toHaveTextContent(/update the price/i)

    await userEvent.click(screen.getByTestId('sale-error-retry'))
    await userEvent.click(screen.getByTestId('update-price-submit'))
    expect(update.mutate).toHaveBeenCalledTimes(2)
    expect(last(sell.mutate)[0]).toMatchObject({
      price: { kind: 'credits', credits: 80 },
      beneficiary: ADDRESS,
      expiresAt: NO_EXPIRATION
    })
    expect(screen.getByTestId('update-price-signing-step-2')).toHaveAttribute('data-state', 'current')
    await act(async () => last(sell.mutate)[1].onSuccess?.({}))
    expect(screen.getByTestId('sale-success-title')).toBeInTheDocument()
  })

  it('shows only "Updating price" to a social-login creator', async () => {
    renderFlow(ProviderType.MAGIC)
    await submitPrice('80')
    expect(screen.getByTestId('update-price-pending-label')).toHaveTextContent(/updating price/i)
    expect(screen.queryByTestId('update-price-pending-cancel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('update-price-signing')).not.toBeInTheDocument()
  })
})
