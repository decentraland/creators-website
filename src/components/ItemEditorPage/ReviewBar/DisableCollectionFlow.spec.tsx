import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { DisableCollectionFlow } from './DisableCollectionFlow'

type Callbacks = { onSuccess: () => void; onError: (error: unknown) => void }
type Variables = { collection: Collection; onSigned: () => void }

const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  showToast: vi.fn(),
  isError: false
}))
vi.mock('~/hooks/useCuration', () => ({
  useDisableCollection: () => ({ mutate: state.mutate, reset: vi.fn(), isPending: false, isError: state.isError })
}))
vi.mock('~/lib/notifications', () => ({
  useNotifications: (select: (s: { showToast: typeof state.showToast }) => unknown) =>
    select({ showToast: state.showToast })
}))

const web3 = { address: '0xme', providerType: 'injected' } as Session
const collection = { id: 'c1', name: 'Hats' } as Collection

function renderFlow(session: Session = web3) {
  const onClose = vi.fn()
  render(
    <TranslationProvider>
      <DisableCollectionFlow session={session} collection={collection} onClose={onClose} />
    </TranslationProvider>
  )
  return onClose
}

function lastCall(): [Variables, Callbacks] {
  return state.mutate.mock.lastCall as [Variables, Callbacks]
}

beforeEach(() => {
  vi.clearAllMocks()
  state.isError = false
})

describe('DisableCollectionFlow', () => {
  it('waits on the wallet, then on the transaction, and closes with a toast', () => {
    const onClose = renderFlow()
    fireEvent.click(screen.getByTestId('review-disable-confirm'))
    expect(screen.getByTestId('review-disable-signing')).toBeInTheDocument()

    act(() => lastCall()[0].onSigned())
    expect(screen.getByTestId('review-disable-pending')).toBeInTheDocument()

    act(() => lastCall()[1].onSuccess())
    expect(state.showToast).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('goes back to the confirmation when the curator backs out of the wallet prompt', () => {
    renderFlow()
    fireEvent.click(screen.getByTestId('review-disable-confirm'))
    fireEvent.click(screen.getByTestId('review-disable-signing-cancel'))
    expect(screen.getByTestId('review-disable')).toBeInTheDocument()

    act(() => lastCall()[0].onSigned())
    expect(screen.queryByTestId('review-disable-pending')).not.toBeInTheDocument()
  })

  it('goes back to the confirmation when the wallet rejects', () => {
    renderFlow()
    fireEvent.click(screen.getByTestId('review-disable-confirm'))
    act(() => lastCall()[1].onError({ code: 4001 }))
    expect(screen.getByTestId('review-disable')).toBeInTheDocument()
  })

  it('skips the wallet prompt screen for social logins', () => {
    renderFlow({ address: '0xme', providerType: 'magic' } as Session)
    fireEvent.click(screen.getByTestId('review-disable-confirm'))
    expect(screen.queryByTestId('review-disable-signing')).not.toBeInTheDocument()
    expect(screen.getByTestId('review-disable')).toBeInTheDocument()
  })
})
