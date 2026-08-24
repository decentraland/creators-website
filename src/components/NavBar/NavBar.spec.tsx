import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '~/intl'
import { config } from '~/config'
import { NavBar } from './NavBar'

vi.mock('~/components/TopNav', () => ({
  TopNav: () => <div data-testid="topnav" />
}))

vi.mock('~/store/wallet', () => ({
  useWallet: () => ({
    session: undefined,
    connecting: false,
    signIn: vi.fn(),
    disconnect: vi.fn(),
    restore: vi.fn()
  })
}))

vi.mock('~/hooks/useProfile', () => ({
  useProfile: () => ({ data: undefined, isLoading: false })
}))

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
  it('shows the section tabs, sending Overview to sites and Scenes and Land to the legacy builder', () => {
    renderNavBar()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', config.get('CREATE_URL'))
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
})
