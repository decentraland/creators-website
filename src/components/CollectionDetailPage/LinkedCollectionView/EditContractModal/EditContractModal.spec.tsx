import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { EditContractModal } from './EditContractModal'

vi.mock('~/lib/linkedContract', async importOriginal => ({
  ...(await importOriginal<typeof import('~/lib/linkedContract')>()),
  checkLinkedContract: vi.fn()
}))

import { checkLinkedContract } from '~/lib/linkedContract'

const CONTRACT = '0x1D9FB685C257E74F869BA302E260C0B68F5EBB37'
const checkMock = vi.mocked(checkLinkedContract)
const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>

function renderModal(props: Partial<React.ComponentProps<typeof EditContractModal>> = {}) {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const view = render(<EditContractModal step={null} error={null} onSubmit={onSubmit} onClose={onClose} {...props} />, {
    wrapper
  })
  return { onSubmit, onClose, rerender: view.rerender }
}

async function fillForm(address = CONTRACT) {
  await userEvent.click(screen.getByTestId('linked-network'))
  await userEvent.click(within(screen.getByRole('listbox')).getByText('Amoy'))
  await userEvent.type(screen.getByTestId('linked-contract-address-input'), address)
}

beforeEach(() => {
  checkMock.mockReset()
})

describe('EditContractModal', () => {
  it('submits the checked contract lower-cased', async () => {
    checkMock.mockResolvedValue('ok')
    const { onSubmit } = renderModal()
    expect(screen.getByTestId('edit-contract-submit')).toBeDisabled()

    await fillForm()
    await waitFor(() => expect(screen.getByTestId('edit-contract-submit')).toBeEnabled(), { timeout: 3000 })
    await userEvent.click(screen.getByTestId('edit-contract-submit'))

    expect(onSubmit).toHaveBeenCalledWith({ network: 'amoy', address: CONTRACT.toLowerCase() })
  })

  it('shows which step is running and keeps the dialog from closing meanwhile', () => {
    const { onClose } = renderModal({ step: 'tx' })
    expect(screen.getByTestId('edit-contract-step')).toHaveTextContent('Confirm in your wallet')
    expect(screen.getByTestId('edit-contract-submit')).toBeDisabled()
    expect(screen.getByTestId('edit-contract-cancel')).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the failed run until the contract is edited again', async () => {
    renderModal({ error: 'Something failed' })
    expect(screen.getByTestId('edit-contract-error')).toHaveTextContent('Something failed')
    await userEvent.type(screen.getByTestId('linked-contract-address-input'), '0x')
    expect(screen.queryByTestId('edit-contract-error')).not.toBeInTheDocument()
  })
})
