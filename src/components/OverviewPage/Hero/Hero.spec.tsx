import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type CreatorHubDownload, startCreatorHubDownload } from '~/lib/creatorHubDownload'
import { sendOverviewTrack as track } from '~/lib/overviewSegment'
import { Hero } from './Hero'

vi.mock('~/lib/overviewSegment', () => ({ sendOverviewTrack: vi.fn(), sendOverviewPage: vi.fn() }))

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('~/hooks/useMediaQuery', () => ({ useMediaQuery: () => viewport.mobile }))

const release = vi.hoisted(() => ({ download: undefined as CreatorHubDownload | undefined }))
vi.mock('~/hooks/useCreatorHubDownload', () => ({ useCreatorHubDownload: () => release.download }))
vi.mock('~/lib/creatorHubDownload', () => ({ startCreatorHubDownload: vi.fn() }))

beforeEach(() => {
  viewport.mobile = false
  release.download = undefined
  vi.mocked(startCreatorHubDownload).mockClear()
  vi.mocked(track).mockClear()
})

const renderHero = () =>
  render(
    <TranslationProvider>
      <Hero />
    </TranslationProvider>
  )

describe('Hero', () => {
  it('sends desktop visitors to the download page until an installer is known', () => {
    renderHero()
    const cta = screen.getByTestId('overview-hero-cta')
    expect(cta).toHaveTextContent('Download Creator Hub')
    expect(cta).toHaveAttribute('href', 'https://decentraland.zone/download/creator-hub')
    expect(cta).not.toHaveAttribute('target')

    fireEvent.click(cta)
    expect(startCreatorHubDownload).not.toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith('Click', {
      place: 'Creators Hero',
      event: 'Download',
      download_target: 'creator_hub'
    })
  })

  it('downloads the installer for the visitor OS in one click', () => {
    release.download = { os: 'macOS', arch: 'arm64', href: 'https://example.com/creator-hub-mac-arm64.dmg' }
    renderHero()
    const cta = screen.getByTestId('overview-hero-cta')
    expect(cta).toHaveAttribute('href', 'https://example.com/creator-hub-mac-arm64.dmg')

    fireEvent.click(cta)
    expect(startCreatorHubDownload).toHaveBeenCalledWith(release.download)
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
