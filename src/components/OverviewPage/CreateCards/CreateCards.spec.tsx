import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { track } from '~/lib/analytics'
import { CreateCards } from './CreateCards'

vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('react-intersection-observer', () => ({ useInView: () => ({ ref: vi.fn(), inView: true }) }))

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('~/hooks/useMediaQuery', () => ({ useMediaQuery: () => viewport.mobile }))

beforeEach(() => {
  viewport.mobile = false
  vi.mocked(track).mockClear()
})

const renderSection = () =>
  render(
    <TranslationProvider>
      <CreateCards />
    </TranslationProvider>
  )

// Inactive carousel slides are aria-hidden, so role queries only see the first card; go by test id.
const linkNamed = (label: string) =>
  screen.getAllByTestId('overview-create-link').find(link => link.textContent === label)

const downloadLinks = () =>
  screen
    .getAllByTestId('overview-create-link')
    .filter(link => link.getAttribute('href') === 'https://decentraland.zone/download/creator-hub')

describe('CreateCards', () => {
  it('shows the wearables, emotes and experiences cards with the scene docs open by default', () => {
    renderSection()
    const cards = screen.getAllByTestId('overview-create-card')
    expect(cards.map(card => card.getAttribute('data-card'))).toEqual(['wearables', 'emotes', 'experiences'])
    expect(linkNamed('About the Scene Editor')).toHaveAttribute(
      'href',
      'https://docs.decentraland.org/creator/scene-editor/get-started/about-editor'
    )
  })

  it('switches tabs and tracks the switch with the card and tab', () => {
    renderSection()
    const wearables = screen.getAllByTestId('overview-create-card')[0]
    fireEvent.click(within(wearables).getByRole('tab', { name: 'Smart Wearables' }))
    expect(within(wearables).getByRole('link', { name: 'Smart Wearables Docs' })).toBeInTheDocument()
    expect(within(wearables).queryByRole('link', { name: 'Creating Wearables' })).toBeNull()
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Create', card: 'wearables', tab: 'smart' })
  })

  it('tracks a resource link with its card, tab and label', () => {
    renderSection()
    fireEvent.click(screen.getByRole('link', { name: 'Creating Wearables' }))
    expect(track).toHaveBeenCalledWith('Click', {
      place: 'Creators Create',
      card: 'wearables',
      tab: 'regular',
      title: 'Creating Wearables'
    })
  })

  it('offers the Creator Hub download on desktop but hides it on phones', () => {
    renderSection()
    expect(downloadLinks().length).toBeGreaterThan(0)
  })

  it('hides the desktop-only download links on phones, keeping the rest', () => {
    viewport.mobile = true
    renderSection()
    expect(downloadLinks()).toHaveLength(0)
    expect(linkNamed('About the Scene Editor')).toBeInTheDocument()
  })
})
