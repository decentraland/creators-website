import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NavbarProps } from 'decentraland-ui2'
import { TranslationProvider } from '~/intl'
import { config } from '~/config'
import { openExternal } from '~/lib/navigation'
import { NavBar } from './NavBar'

// Stands in for the ui2 navbar: surfaces the balance chips the real one renders from these props.
vi.mock('~/components/TopNav', () => ({
  TopNav: ({ shopCreditsBalance, onClickShopCredits, manaBalances, onClickBalance }: NavbarProps) => (
    <div data-testid="topnav">
      {shopCreditsBalance !== undefined && (
        <button data-testid="topnav-credits" onClick={onClickShopCredits}>
          {shopCreditsBalance}
        </button>
      )}
      {manaBalances?.MATIC !== undefined && (
        <button data-testid="topnav-mana" onClick={() => onClickBalance?.('MATIC' as never)}>
          {manaBalances.MATIC}
        </button>
      )}
    </div>
  )
}))

const wallet = vi.hoisted(() => ({ session: undefined as { address: string } | undefined }))
vi.mock('~/store/wallet', () => ({
  useWallet: () => ({
    session: wallet.session,
    connecting: false,
    signIn: vi.fn(),
    disconnect: vi.fn(),
    restore: vi.fn()
  })
}))

vi.mock('~/hooks/useProfile', () => ({
  useProfile: () => ({ data: undefined, isLoading: false })
}))

const balances = vi.hoisted(() => ({
  credits: undefined as number | undefined,
  manaWei: undefined as bigint | undefined
}))
vi.mock('~/hooks/useBalances', () => ({
  useCreditsBalance: () => ({ data: balances.credits === undefined ? undefined : { credits: balances.credits } }),
  useManaBalance: () => ({ data: balances.manaWei })
}))

vi.mock('~/lib/navigation', () => ({ openExternal: vi.fn() }))

beforeEach(() => {
  wallet.session = undefined
  balances.credits = undefined
  balances.manaWei = undefined
  vi.mocked(openExternal).mockReset()
})

function renderNavBar(path = '/collections') {
  return render(
    <TranslationProvider>
      <MemoryRouter initialEntries={[path]}>
        <NavBar />
      </MemoryRouter>
    </TranslationProvider>
  )
}

describe('NavBar', () => {
  it('shows the section tabs, keeping Overview and Collections in-app and sending Scenes and Land to the legacy builder', () => {
    renderNavBar()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Collections' })).toHaveAttribute('href', '/collections')
    expect(screen.getByRole('link', { name: 'Scenes' })).toHaveAttribute(
      'href',
      'https://decentraland.zone/builder/scenes'
    )
    expect(screen.getByRole('link', { name: 'Land/World' })).toHaveAttribute(
      'href',
      'https://decentraland.zone/builder/land'
    )
  })

  it('keeps the Collections tab active on nested collection routes', () => {
    renderNavBar('/collections/a1b2')
    expect(screen.getByRole('link', { name: 'Collections' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
  })

  it('lights up Overview on the home route only', () => {
    renderNavBar('/')
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Collections' })).not.toHaveAttribute('aria-current')
  })

  it('deepens the sub-nav once the page scrolls', () => {
    renderNavBar()
    const subnav = screen.getByTestId('subnav')
    expect(subnav).not.toHaveAttribute('data-scrolled')

    Object.defineProperty(window, 'scrollY', { value: 20, writable: true, configurable: true })
    fireEvent.scroll(window)
    expect(subnav).toHaveAttribute('data-scrolled')

    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
    fireEvent.scroll(window)
    expect(subnav).not.toHaveAttribute('data-scrolled')
  })

  it('shows the credits and MANA balances in the top bar, linking out to buy more', () => {
    wallet.session = { address: '0xabc' }
    balances.credits = 42
    balances.manaWei = 1_234_500_000_000_000_000_000n
    renderNavBar()

    expect(screen.getByTestId('topnav-credits')).toHaveTextContent('42')
    expect(screen.getByTestId('topnav-mana')).toHaveTextContent('1234.5')

    fireEvent.click(screen.getByTestId('topnav-credits'))
    expect(openExternal).toHaveBeenCalledWith(`${config.get('SHOP_URL')}/credits`)
    fireEvent.click(screen.getByTestId('topnav-mana'))
    expect(openExternal).toHaveBeenCalledWith(config.get('ACCOUNT_URL'))
  })

  it('shows no balance chips until each balance has loaded', () => {
    wallet.session = { address: '0xabc' }
    renderNavBar()
    expect(screen.queryByTestId('topnav-credits')).toBeNull()
    expect(screen.queryByTestId('topnav-mana')).toBeNull()
  })

  it('shows zero credits but hides the MANA chip for an empty wallet', () => {
    wallet.session = { address: '0xabc' }
    balances.credits = 0
    balances.manaWei = 0n
    renderNavBar()
    expect(screen.getByTestId('topnav-credits')).toHaveTextContent('0')
    expect(screen.queryByTestId('topnav-mana')).toBeNull()
  })
})
