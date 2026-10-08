import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { sendOverviewTrack as track } from '~/lib/overviewSegment'
import { heroData } from '../data'
import { Hero } from './Hero'

vi.mock('~/lib/overviewSegment', () => ({ sendOverviewTrack: vi.fn(), sendOverviewPage: vi.fn() }))

const viewport = vi.hoisted(() => ({ mobile: false, reducedMotion: false }))
vi.mock('~/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) => (query.includes('reduced-motion') ? viewport.reducedMotion : viewport.mobile)
}))

beforeEach(() => {
  viewport.mobile = false
  viewport.reducedMotion = false
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

  it('paints the poster first and fades the video in on desktop once the page is idle', async () => {
    renderHero()
    expect(screen.getByTestId('overview-hero-poster')).toHaveAttribute('src', heroData.poster.url)

    const video = await screen.findByTestId('overview-hero-video')
    expect(video).not.toHaveAttribute('data-playing')
    fireEvent.playing(video)
    expect(video).toHaveAttribute('data-playing')
  })

  it('fades the video in again after it was dropped for a phone width', async () => {
    const { rerender } = renderHero()
    fireEvent.playing(await screen.findByTestId('overview-hero-video'))

    viewport.mobile = true
    rerender(
      <TranslationProvider>
        <Hero />
      </TranslationProvider>
    )
    expect(screen.queryByTestId('overview-hero-video')).not.toBeInTheDocument()

    viewport.mobile = false
    rerender(
      <TranslationProvider>
        <Hero />
      </TranslationProvider>
    )
    expect(await screen.findByTestId('overview-hero-video')).not.toHaveAttribute('data-playing')
  })

  it('keeps phones on the static poster', async () => {
    viewport.mobile = true
    renderHero()
    expect(screen.getByTestId('overview-hero-poster')).toHaveAttribute('src', heroData.poster.url)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByTestId('overview-hero-video')).not.toBeInTheDocument()
  })

  it('hides the poster instead of a broken image when it fails to load', () => {
    renderHero()
    fireEvent.error(screen.getByTestId('overview-hero-poster'))
    expect(screen.queryByTestId('overview-hero-poster')).not.toBeInTheDocument()
  })

  it('keeps visitors who prefer reduced motion on the static poster', async () => {
    viewport.reducedMotion = true
    renderHero()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(screen.queryByTestId('overview-hero-video')).not.toBeInTheDocument()
  })

  it('preloads the same poster from index.html', () => {
    const html = readFileSync(`${process.cwd()}/index.html`, 'utf8')
    // Vite fills %BASE_URL% with the same base the bundle reads from import.meta.env.BASE_URL.
    const base = import.meta.env.BASE_URL
    const candidates = heroData.poster.srcSet.split(', ').map(candidate => `%BASE_URL%${candidate.slice(base.length)}`)
    expect(html).toContain(candidates.join(', '))
  })
})
