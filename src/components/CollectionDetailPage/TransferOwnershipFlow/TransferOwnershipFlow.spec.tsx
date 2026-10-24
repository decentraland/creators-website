import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderType } from '@dcl/schemas'
import { SellItemError } from '~/lib/sales'
import { TransferOwnershipFlow } from './TransferOwnershipFlow'
import { ADDRESS, FRIEND, Providers, collection, makeSession } from '../SellItemFlow/testUtils'

type Callbacks = { onSuccess?: (result: unknown) => void; onError?: (error: unknown) => void }
type Variables = { newOwner: string; onSigned?: () => void }

const transfer = { mutate: vi.fn<(variables: Variables, callbacks: Callbacks) => void>(), isPending: false }
vi.mock('~/hooks/useTransferCollectionOwnership', () => ({ useTransferCollectionOwnership: () => transfer }))
vi.mock('~/hooks/useSales', () => ({
  useFriends: () => ({
    data: [{ address: FRIEND, name: 'Ana', hasClaimedName: true, avatarUrl: '' }],
    isLoading: false
  })
}))
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

function renderFlow(providerType = ProviderType.INJECTED) {
  const onClose = vi.fn()
  const onDone = vi.fn()
  render(
    <TransferOwnershipFlow
      collection={collection}
      session={makeSession(providerType)}
      onDone={onDone}
      onClose={onClose}
    />,
    { wrapper: Providers }
  )
  return { onClose, onDone }
}

async function fillIn(name = collection.name) {
  await userEvent.type(screen.getByTestId('new-owner-input'), FRIEND)
  await userEvent.type(screen.getByTestId('transfer-confirmation-input'), name)
}

const last = <T,>(mock: { mock: { calls: T[] } }) => mock.mock.calls[mock.mock.calls.length - 1]

beforeEach(() => {
  transfer.mutate.mockReset()
  transfer.isPending = false
})

describe('TransferOwnershipFlow', () => {
  it('enables the transfer only once a new owner is picked and the collection name is typed', async () => {
    renderFlow()
    expect(screen.getByTestId('transfer-ownership-modal')).toHaveTextContent(/transfer ownership/i)
    expect(screen.getByTestId('transfer-submit')).toBeDisabled()

    await userEvent.type(screen.getByTestId('new-owner-input'), FRIEND)
    expect(screen.getByTestId('new-owner-name')).toHaveTextContent('Ana')
    expect(screen.getByTestId('transfer-submit')).toBeDisabled()

    await userEvent.type(screen.getByTestId('transfer-confirmation-input'), 'Pirate Hat')
    expect(screen.getByTestId('transfer-submit')).toBeDisabled()
    await userEvent.type(screen.getByTestId('transfer-confirmation-input'), 's')
    expect(screen.getByTestId('transfer-submit')).toBeEnabled()
  })

  it("refuses the owner's own address with an inline reason", async () => {
    renderFlow()
    await userEvent.type(screen.getByTestId('new-owner-input'), ADDRESS)
    expect(screen.getByTestId('new-owner-error')).toHaveTextContent(/your own address/i)
    expect(screen.queryByTestId('new-owner-selected')).not.toBeInTheDocument()
  })

  it('closes straight away when empty, but asks before discarding what was filled in', async () => {
    const { onClose } = renderFlow()
    await userEvent.click(screen.getByTestId('transfer-cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.type(screen.getByTestId('transfer-confirmation-input'), 'Pir')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByTestId('discard-transfer-modal-title')).toHaveTextContent(/discard/i)
    await userEvent.click(screen.getByTestId('discard-transfer-keep'))
    expect(screen.getByTestId('transfer-confirmation-input')).toHaveValue('Pir')
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByTestId('transfer-ownership-modal-close'))
    await userEvent.click(screen.getByTestId('discard-transfer-leave'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('walks a web3 wallet through the prompt, then celebrates and hands over on DONE', async () => {
    const { onClose, onDone } = renderFlow()
    await fillIn()
    await userEvent.click(screen.getByTestId('transfer-submit'))

    expect(screen.getByTestId('transfer-ownership-pending-label')).toHaveTextContent(/confirm in your wallet/i)
    const [variables, callbacks] = last(transfer.mutate)
    expect(variables).toMatchObject({ newOwner: FRIEND })

    // Backing out of the prompt returns to the form, untouched.
    await userEvent.click(screen.getByTestId('transfer-ownership-pending-cancel'))
    expect(screen.getByTestId('new-owner-name')).toHaveTextContent('Ana')
    expect(screen.getByTestId('transfer-confirmation-input')).toHaveValue(collection.name)
    await act(async () => callbacks.onSuccess?.(undefined))
    expect(screen.queryByTestId('sale-success-modal')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('transfer-submit'))
    const [again, done] = last(transfer.mutate)
    await act(async () => again.onSigned?.())
    expect(screen.getByTestId('transfer-ownership-pending-label')).toHaveTextContent(/transferring ownership/i)
    expect(screen.queryByTestId('transfer-ownership-pending-cancel')).not.toBeInTheDocument()
    await act(async () => done.onSuccess?.(undefined))
    expect(screen.getByTestId('sale-success-title')).toHaveTextContent(/ownership transferred/i)
    expect(screen.getByTestId('sale-success-description')).toHaveTextContent(/0x0000…00bb/)
    await userEvent.click(screen.getByTestId('sale-success-done'))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps a custodial wallet in the dialog with the button spinning', async () => {
    renderFlow(ProviderType.MAGIC)
    await fillIn()
    transfer.isPending = true
    await userEvent.click(screen.getByTestId('transfer-submit'))
    expect(screen.queryByTestId('transfer-ownership-pending')).not.toBeInTheDocument()
    expect(last(transfer.mutate)[0]).toMatchObject({ newOwner: FRIEND })
  })

  it('reports a failure and lets TRY AGAIN reopen the form, while a dismissed prompt just returns to it', async () => {
    const { onClose } = renderFlow()
    await fillIn()
    await userEvent.click(screen.getByTestId('transfer-submit'))
    await act(async () => last(transfer.mutate)[1].onError?.(new SellItemError('rejected')))
    expect(screen.getByTestId('new-owner-name')).toHaveTextContent('Ana')

    await userEvent.click(screen.getByTestId('transfer-submit'))
    await act(async () => last(transfer.mutate)[1].onError?.(new Error('boom')))
    expect(screen.getByTestId('sale-error-modal-title')).toHaveTextContent(/transfer the ownership/i)
    await userEvent.click(screen.getByTestId('sale-error-retry'))
    expect(screen.getByTestId('new-owner-name')).toHaveTextContent('Ana')
    expect(onClose).not.toHaveBeenCalled()
  })
})
