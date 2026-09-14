import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderType } from '@dcl/schemas'
import { type Item } from '~/lib/items'
import { type Transfer } from '~/lib/mint'
import { SendItemsFlow } from './SendItemsFlow'
import { FRIEND, Providers, collection, item, makeSession } from '../SellItemFlow/testUtils'

type Callbacks = { onSuccess?: (result: unknown) => void; onError?: (error: unknown) => void }
type Variables = { transfers: Transfer[]; onSigned?: () => void }

const send = { mutate: vi.fn<(variables: Variables, callbacks: Callbacks) => void>(), isPending: false }
vi.mock('~/hooks/useSales', () => ({
  useSendItems: () => send,
  useFriends: () => ({ data: [], isLoading: false })
}))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

const OTHER = '0x00000000000000000000000000000000000000dd'
const THIRD = '0x00000000000000000000000000000000000000ee'
// mythic: 10 copies. hat has 90 left (legendary), scarce 2, soldOut none, draft isn't sendable.
const scarce: Item = { ...item, id: 'i2', name: 'Scarce', tokenId: '4', rarity: 'mythic', totalSupply: 8 }
const soldOut: Item = { ...item, id: 'i3', name: 'Gone', tokenId: '5', totalSupply: 100 }
const draft: Item = { ...item, id: 'i4', name: 'Draft', tokenId: undefined, isPublished: false }
const items = [item, scarce, soldOut, draft]

function renderFlow(providerType = ProviderType.INJECTED) {
  const onClose = vi.fn()
  const view = render(
    <SendItemsFlow collection={collection} items={items} session={makeSession(providerType)} onClose={onClose} />,
    { wrapper: Providers }
  )
  return { onClose, view }
}

const last = <T,>(mock: { mock: { calls: T[] } }) => mock.mock.calls[mock.mock.calls.length - 1]

async function addRecipient(transfer: number, address: string) {
  await userEvent.type(screen.getByTestId(`transfer-${transfer}-recipient-input`), address)
}

beforeEach(() => {
  send.mutate.mockReset()
  send.isPending = false
})

describe('SendItemsFlow', () => {
  it('lists only sendable items, with sold-out ones disabled, and needs a recipient plus a copy to continue', async () => {
    renderFlow()
    expect(screen.queryByTestId('transfer-1-item-i4')).not.toBeInTheDocument()
    expect(screen.getByTestId('transfer-1-item-i3-check')).toBeDisabled()
    expect(screen.getByTestId('transfer-1-item-i3-stock')).toHaveTextContent(/sold out/i)
    expect(screen.getByTestId('transfer-1-item-i1-stock')).toHaveTextContent('90 / 100 available')
    expect(screen.getByTestId('send-continue')).toBeDisabled()

    await userEvent.click(screen.getByTestId('transfer-1-item-i1-check'))
    expect(screen.getByTestId('transfer-1-item-i1-amount')).toHaveTextContent('1')
    expect(screen.getByTestId('send-continue')).toBeDisabled()

    await addRecipient(1, FRIEND)
    expect(screen.getByTestId('transfer-1-recipient-selected')).toBeInTheDocument()
    expect(screen.getByTestId('send-continue')).toBeEnabled()
    expect(screen.getByTestId('send-total')).toHaveTextContent('1 / 50 items')
  })

  it('steps the copies within the live stock, unchecking at zero, and blocks a repeated recipient', async () => {
    renderFlow()
    await addRecipient(1, FRIEND)
    await userEvent.click(screen.getByTestId('transfer-1-item-i2-plus'))
    await userEvent.click(screen.getByTestId('transfer-1-item-i2-plus'))
    expect(screen.getByTestId('transfer-1-item-i2-amount')).toHaveTextContent('2')
    expect(screen.getByTestId('transfer-1-item-i2-stock')).toHaveTextContent('0 / 10 available')
    expect(screen.getByTestId('transfer-1-item-i2-plus')).toBeDisabled()

    await userEvent.click(screen.getByTestId('transfer-1-item-i2-minus'))
    await userEvent.click(screen.getByTestId('transfer-1-item-i2-minus'))
    expect(screen.getByTestId('transfer-1-item-i2-check')).not.toBeChecked()
    expect(screen.getByTestId('transfer-1-item-i2-minus')).toBeDisabled()

    // A second recipient halves what each may get of the scarce item: 2 copies → 1 each.
    await userEvent.click(screen.getByTestId('transfer-1-item-i2-plus'))
    await userEvent.click(screen.getByTestId('transfer-1-item-i2-plus'))
    await userEvent.click(screen.getByTestId('transfer-1-add-recipient'))
    await addRecipient(1, FRIEND)
    expect(screen.getByTestId('transfer-1-recipient-error')).toHaveTextContent(/already/i)
    expect(screen.getAllByTestId('transfer-1-recipient-selected')).toHaveLength(1)

    await userEvent.clear(screen.getByTestId('transfer-1-recipient-input'))
    await addRecipient(1, OTHER)
    expect(screen.getAllByTestId('transfer-1-recipient-selected')).toHaveLength(2)
    expect(screen.getByTestId('transfer-1-item-i2-amount')).toHaveTextContent('1')
    expect(screen.getByTestId('send-total')).toHaveTextContent('2 / 50 items')
  })

  it('caps a send at 50 copies across transfers and explains why', async () => {
    renderFlow()
    await addRecipient(1, FRIEND)
    await userEvent.click(screen.getByTestId('transfer-1-item-i1-check'))
    for (let i = 0; i < 50; i++) await userEvent.click(screen.getByTestId('transfer-1-item-i1-plus'))
    expect(screen.getByTestId('transfer-1-item-i1-amount')).toHaveTextContent('51')
    expect(screen.getByTestId('send-total')).toHaveAttribute('data-over')
    expect(screen.getByTestId('send-total')).toHaveTextContent(/up to 50/i)
    expect(screen.getByTestId('send-continue')).toBeDisabled()
  })

  it('removes a middle transfer without disturbing the ones after it', async () => {
    renderFlow()
    await addRecipient(1, FRIEND)
    await userEvent.click(screen.getByTestId('send-add-transfer'))
    await addRecipient(2, OTHER)
    // Leave the second transfer mid-edit, with an open input for another recipient.
    await userEvent.click(screen.getByTestId('transfer-2-add-recipient'))
    await userEvent.click(screen.getByTestId('send-add-transfer'))
    await addRecipient(3, THIRD)
    await userEvent.click(screen.getByTestId('transfer-3-item-i1-check'))
    expect(screen.getByTestId('transfer-2-recipient-input')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('transfer-2-remove'))
    expect(screen.queryByTestId('transfer-3')).not.toBeInTheDocument()
    expect(screen.getByTestId('transfer-2-recipient-selected')).toHaveTextContent(THIRD)
    expect(screen.getByTestId('transfer-2-item-i1-amount')).toHaveTextContent('1')
    expect(screen.queryByTestId('transfer-2-recipient-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('send-total')).toHaveTextContent('1 / 50 items')
  })

  it('reviews every complete transfer, walks a web3 wallet through the prompt and celebrates the send', async () => {
    const { onClose } = renderFlow()
    await addRecipient(1, FRIEND)
    await userEvent.click(screen.getByTestId('transfer-1-item-i1-check'))
    await userEvent.click(screen.getByTestId('send-add-transfer'))
    await addRecipient(2, OTHER)
    await userEvent.click(screen.getByTestId('transfer-2-item-i2-plus'))
    await userEvent.click(screen.getByTestId('transfer-2-item-i2-plus'))
    // An extra, empty transfer is ignored rather than blocking the send.
    await userEvent.click(screen.getByTestId('send-add-transfer'))
    await userEvent.click(screen.getByTestId('send-continue'))

    expect(screen.getByTestId('send-steps-2')).toHaveAttribute('data-state', 'current')
    expect(screen.getAllByTestId(/^send-summary-\d$/)).toHaveLength(2)
    expect(screen.getByTestId('send-summary-1')).toHaveTextContent('1 Recipient - 1 Item - 1 Copy')
    expect(screen.getByTestId('send-summary-2')).toHaveTextContent('1 Recipient - 1 Item - 2 Copies')
    expect(screen.getByTestId(`send-summary-2-${OTHER}-i2`)).toHaveTextContent('2')

    await userEvent.click(screen.getByTestId('send-submit'))
    expect(screen.getByTestId('send-items-pending-label')).toHaveTextContent(/confirm in your wallet/i)
    const [variables, callbacks] = last(send.mutate)
    expect(variables.transfers).toMatchObject([
      { recipients: [FRIEND], amounts: { i1: 1 } },
      { recipients: [OTHER], amounts: { i2: 2 } },
      { recipients: [], amounts: {} }
    ])
    await act(async () => variables.onSigned?.())
    expect(screen.getByTestId('send-items-pending-label')).toHaveTextContent(/sending items/i)
    expect(screen.queryByTestId('send-items-pending-cancel')).not.toBeInTheDocument()

    await act(async () => callbacks.onSuccess?.(undefined))
    expect(screen.getByTestId('sale-success-title')).toHaveTextContent(/items sent/i)
    await userEvent.click(screen.getByTestId('sale-success-done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('returns to the confirm step with everything kept after a cancelled prompt, a rejection or a retry', async () => {
    renderFlow()
    await addRecipient(1, FRIEND)
    await userEvent.click(screen.getByTestId('transfer-1-item-i1-check'))
    await userEvent.click(screen.getByTestId('send-continue'))

    await userEvent.click(screen.getByTestId('send-submit'))
    await userEvent.click(screen.getByTestId('send-items-pending-cancel'))
    expect(screen.getByTestId('send-summary-1')).toBeInTheDocument()
    await act(async () => last(send.mutate)[1].onSuccess?.(undefined))
    expect(screen.queryByTestId('sale-success-title')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('send-submit'))
    await act(async () => last(send.mutate)[1].onError?.({ code: 4001, message: 'User rejected' }))
    expect(screen.getByTestId('send-summary-1')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('send-submit'))
    await act(async () => last(send.mutate)[1].onError?.(new Error('reverted')))
    expect(screen.getByTestId('sale-error-modal-title')).toHaveTextContent(/send your items/i)
    await userEvent.click(screen.getByTestId('sale-error-retry'))
    expect(screen.getByTestId('send-summary-1')).toHaveTextContent('1 Recipient - 1 Item - 1 Copy')
  })

  it('keeps a social-login creator on the dialog with a spinning button', async () => {
    const { view } = renderFlow(ProviderType.MAGIC)
    await addRecipient(1, FRIEND)
    await userEvent.click(screen.getByTestId('transfer-1-item-i1-check'))
    await userEvent.click(screen.getByTestId('send-continue'))
    await userEvent.click(screen.getByTestId('send-submit'))
    send.isPending = true
    view.rerender(
      <SendItemsFlow
        collection={collection}
        items={items}
        session={makeSession(ProviderType.MAGIC)}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTestId('send-submit')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('send-items-pending')).not.toBeInTheDocument()
  })
})
