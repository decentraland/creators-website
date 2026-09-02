import { describe, it, expect, vi } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { Modal } from './Modal'

const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn()
  const view = render(
    <Modal title="Test Modal" onClose={onClose} {...props}>
      <p>Body</p>
    </Modal>,
    { wrapper }
  )
  return { onClose, view }
}

describe('Modal', () => {
  it('renders the title, body and an accessible dialog', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Test Modal' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('closes from the ✕ button, Escape and the scrim, but not from inside the dialog', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByText('Body'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('modal-close'))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('modal-scrim'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('ignores every close affordance while closeDisabled', async () => {
    const { onClose } = renderModal({ closeDisabled: true })
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('modal-scrim'))
    expect(screen.getByTestId('modal-close')).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks page scroll while open and restores it on unmount', () => {
    const { view } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the page scroll unlocked only after every stacked modal is gone', () => {
    const first = renderModal()
    const second = render(
      <Modal title="Stacked" onClose={vi.fn()}>
        <p>Stacked body</p>
      </Modal>,
      { wrapper }
    )
    expect(document.body.style.overflow).toBe('hidden')

    // Closing in either order must not leave the page locked.
    first.view.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
