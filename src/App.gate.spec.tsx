// The gate end to end: the real hook over the real flag reader, so the pending → open path is exercised.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { FeatureFlag, resetFeatureFlagsCache } from '~/lib/featureFlags'

vi.mock('~/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => ({ enabled: false, isLoading: false }) }))
vi.mock('~/hooks/useAccountWatcher', () => ({ useAccountWatcher: () => undefined }))
const wallet = vi.hoisted(() => ({ address: undefined as string | undefined }))
vi.mock('~/store/wallet', () => ({
  useWallet: (
    selector: (s: { session: { address: string } | null; restored: boolean; restore: () => Promise<void> }) => unknown
  ) =>
    selector({
      session: wallet.address ? { address: wallet.address } : null,
      restored: true,
      restore: () => Promise.resolve()
    })
}))
vi.mock('~/components/NavBar', () => ({
  NavBar: ({ subnav }: { subnav?: boolean }) => <div data-testid="navbar" data-subnav={String(subnav)} />
}))
vi.mock('~/components/Footer', () => ({ Footer: () => null }))
vi.mock('~/components/Intercom', () => ({ Intercom: () => null }))
vi.mock('~/components/Toasts', () => ({ Toasts: () => null }))
vi.mock('~/components/OverviewPage', () => ({ OverviewPage: () => <div data-testid="overview" /> }))
vi.mock('~/components/CollectionsPage', () => ({ CollectionsPage: () => <div data-testid="collections" /> }))
vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('~/lib/pageViews', () => ({ trackPageView: vi.fn() }))

const { App } = await import('./App')

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ALLOWED = '0x0000000000000000000000000000000000000001'

let answerFlags: (body: unknown) => void
function holdFlags() {
  fetchMock.mockImplementation(
    () =>
      new Promise(resolve => {
        answerFlags = body => resolve(new Response(JSON.stringify(body), { status: 200 }))
      })
  )
}
const armed = (addresses: string) => ({
  flags: { [`builder-${FeatureFlag.CREATORS_PRELAUNCH}`]: true },
  variants: {
    [`builder-${FeatureFlag.CREATORS_PRELAUNCH}`]: { enabled: true, payload: { type: 'string', value: addresses } }
  }
})

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  resetFeatureFlagsCache()
  wallet.address = undefined
  holdFlags()
})
afterEach(() => fetchMock.mockReset())

describe('App gate over the real flag read', () => {
  it('holds a direct link to an inner page on the spinner, then renders it once the flag reads off', async () => {
    renderApp('/collections')
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByTestId('navbar')).toHaveAttribute('data-subnav', 'false')

    answerFlags({ flags: {} })
    await screen.findByTestId('collections')
    expect(screen.getByTestId('navbar')).toHaveAttribute('data-subnav', 'true')
    expect(document.body).not.toHaveAttribute('data-no-subnav')
  })

  it('shows the overview right away and brings the sub-nav in once the flag lets a listed wallet through', async () => {
    wallet.address = ALLOWED
    renderApp('/')
    expect(screen.getByTestId('overview')).toBeInTheDocument()
    expect(document.body).toHaveAttribute('data-no-subnav')

    answerFlags(armed(ALLOWED))
    await waitFor(() => expect(screen.getByTestId('navbar')).toHaveAttribute('data-subnav', 'true'))
    expect(document.body).not.toHaveAttribute('data-no-subnav')
  })

  it('sends a direct link back to the overview for a visitor the armed flag does not list', async () => {
    renderApp('/collections')
    answerFlags(armed(ALLOWED))
    await screen.findByTestId('overview')
    expect(screen.queryByTestId('collections')).toBeNull()
    expect(screen.getByTestId('navbar')).toHaveAttribute('data-subnav', 'false')
  })
})
