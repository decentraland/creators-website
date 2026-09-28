import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { sendOverviewTrack as track } from '~/lib/overviewSegment'
import { Hero } from './Hero'

vi.mock('~/lib/overviewSegment', () => ({ sendOverviewTrack: vi.fn(), sendOverviewPage: vi.fn() }))

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('~/hooks/useMediaQuery', () => ({ useMediaQuery: () => viewport.mobile }))

beforeEach(() => {
  viewport.mobile = false
  vi.mocked(track).mockClear()
})

const renderHero = () =>
  render(
    <TranslationProvider>
      <Hero />
    </TranslationProvider>
  )

describe('Hero', () => {
  it('sends desktop visitors to the Creator Hub download page and tracks the click', () => {
    renderHero()
    const cta = screen.getByTestId('overview-hero-cta')
    expect(cta).toHaveTextContent('Download Creator Hub')
    expect(cta).toHaveAttribute('href', 'https://decentraland.zone/download/creator-hub')
    expect(cta).not.toHaveAttribute('target')

    fireEvent.click(cta)
    expect(track).toHaveBeenCalledWith('Click', {
      place: 'Creators Hero',
      event: 'Download',
      download_target: 'creator_hub'
    })
  })

  it('sends phones to the creator docs instead of the desktop-only download', () => {
    viewport.mobile = true
    renderHero()
    const cta = screen.getByTestId('overview-hero-cta')
    expect(cta).toHaveTextContent('Explore the Creator Docs')
    expect(cta).toHaveAttribute('href', 'https://docs.decentraland.org/creator/')
    expect(cta).not.toHaveAttribute('target')

    fireEvent.click(cta)
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Hero' })
  })

  it('types the rotating word into the title', () => {
    renderHero()
    expect(screen.getByTestId('overview-hero-word')).toHaveTextContent('W')
  })

  it('scrolls down to the next section from the chevron and tracks it', () => {
    window.scrollBy = vi.fn()
    renderHero()
    fireEvent.click(screen.getByRole('button', { name: 'Scroll to the next section' }))
    expect(window.scrollBy).toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Hero', title: 'scroll-to-why' })
  })
})
