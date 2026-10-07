import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { PrelaunchDecision } from '~/hooks/useCreatorsPrelaunch'

const gate = vi.hoisted((): { decision: PrelaunchDecision } => ({ decision: 'open' }))
vi.mock('~/hooks/useCreatorsPrelaunch', () => ({ useCreatorsPrelaunch: () => gate.decision }))
vi.mock('~/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => ({ enabled: false, isLoading: false }) }))
vi.mock('~/hooks/useAccountWatcher', () => ({ useAccountWatcher: () => undefined }))
vi.mock('~/store/wallet', () => ({
  useWallet: (selector: (s: { restore: () => Promise<void> }) => unknown) =>
    selector({ restore: () => Promise.resolve() })
}))
vi.mock('~/components/NavBar', () => ({
  NavBar: ({ subnav }: { subnav?: boolean }) => <div data-testid="navbar" data-subnav={String(subnav)} />
}))
vi.mock('~/components/Footer', () => ({ Footer: () => <footer data-testid="footer" /> }))
vi.mock('~/components/Intercom', () => ({ Intercom: () => null }))
vi.mock('~/components/Toasts', () => ({ Toasts: () => null }))
vi.mock('~/components/OverviewPage', () => ({ OverviewPage: () => <div data-testid="overview" /> }))
vi.mock('~/components/CollectionsPage', () => ({ CollectionsPage: () => <div data-testid="collections" /> }))
vi.mock('~/components/ItemEditorPage', () => ({ ItemEditorPage: () => <div data-testid="editor" /> }))
vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))
const trackPageView = vi.hoisted(() => vi.fn())
vi.mock('~/lib/pageViews', () => ({ trackPageView }))

const { App } = await import('./App')

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

beforeEach(() => {
  gate.decision = 'open'
  trackPageView.mockReset()
})

describe('App behind the pre-launch gate', () => {
  it('serves the overview with the top bar only and sends every other route back to it', async () => {
    gate.decision = 'hidden'
    renderApp('/collections')
    await screen.findByTestId('overview')
    expect(screen.getByTestId('navbar')).toHaveAttribute('data-subnav', 'false')
    expect(document.body).toHaveAttribute('data-no-subnav')
    expect(trackPageView).toHaveBeenCalledTimes(1)
    expect(trackPageView).toHaveBeenCalledWith('/')
  })

  it('still counts the overview view for a curtained visitor', () => {
    gate.decision = 'hidden'
    renderApp('/')
    expect(screen.getByTestId('overview')).toBeInTheDocument()
    expect(trackPageView).toHaveBeenCalledTimes(1)
    expect(trackPageView).toHaveBeenCalledWith('/')
  })

  it('renders and counts the overview at once while the gate is still undecided', () => {
    gate.decision = 'pending'
    renderApp('/')
    expect(screen.getByTestId('overview')).toBeInTheDocument()
    expect(trackPageView).toHaveBeenCalledWith('/')
  })

  it('withholds other routes and their views while the gate is undecided, then opens up', async () => {
    gate.decision = 'pending'
    const { rerender } = renderApp('/collections')
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByTestId('collections')).toBeNull()
    expect(trackPageView).not.toHaveBeenCalled()

    gate.decision = 'open'
    rerender(
      <MemoryRouter initialEntries={['/collections']}>
        <App />
      </MemoryRouter>
    )
    await screen.findByTestId('collections')
    expect(screen.getByTestId('navbar')).toHaveAttribute('data-subnav', 'true')
    expect(document.body).not.toHaveAttribute('data-no-subnav')
    await waitFor(() => expect(trackPageView).toHaveBeenCalledWith('/collections'))
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })

  it('keeps a fullscreen workspace in the shell until the gate opens it', async () => {
    gate.decision = 'pending'
    const { rerender } = renderApp('/collections/editor')
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(document.body).not.toHaveAttribute('data-fullscreen')

    gate.decision = 'open'
    rerender(
      <MemoryRouter initialEntries={['/collections/editor']}>
        <App />
      </MemoryRouter>
    )
    await screen.findByTestId('editor')
    expect(screen.queryByTestId('navbar')).toBeNull()
    expect(document.body).toHaveAttribute('data-fullscreen')
  })

  it('counts a page once even when the gate re-decides on it, as on sign-out', () => {
    const { rerender } = renderApp('/')
    expect(trackPageView).toHaveBeenCalledTimes(1)

    gate.decision = 'hidden'
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByTestId('overview')).toBeInTheDocument()
    expect(trackPageView).toHaveBeenCalledTimes(1)
  })
})
