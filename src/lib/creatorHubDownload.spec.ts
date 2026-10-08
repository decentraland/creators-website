import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendOverviewTrack } from '~/lib/overviewSegment'
import { pickCreatorHubDownload, startCreatorHubDownload, SUCCESS_REDIRECT_DELAY_MS } from './creatorHubDownload'

vi.mock('~/lib/overviewSegment', () => ({ sendOverviewTrack: vi.fn() }))
vi.mock('~/lib/analytics', () => ({ ensureAnonymousId: () => 'anon-1' }))

const asset = (name: string) => ({ name, browser_download_url: `https://example.com/${name}` })
const assets = [
  asset('creator-hub-win-x64.exe'),
  asset('creator-hub-win-x64.exe.blockmap'),
  asset('creator-hub-mac-arm64.dmg'),
  asset('creator-hub-mac-x64.dmg')
]
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

describe('pickCreatorHubDownload', () => {
  it('picks the Windows installer on Windows', () => {
    expect(pickCreatorHubDownload(assets, WINDOWS_UA)).toEqual({
      os: 'Windows',
      arch: 'amd64',
      href: 'https://example.com/creator-hub-win-x64.exe'
    })
  })

  it('picks the Apple Silicon build on a Mac, and the Intel one when that is all the release has', () => {
    expect(pickCreatorHubDownload(assets, MAC_UA)?.href).toBe('https://example.com/creator-hub-mac-arm64.dmg')
    expect(pickCreatorHubDownload([asset('creator-hub-mac-x64.dmg')], MAC_UA)).toEqual({
      os: 'macOS',
      arch: 'amd64',
      href: 'https://example.com/creator-hub-mac-x64.dmg'
    })
  })

  it('offers nothing where no installer ships', () => {
    expect(pickCreatorHubDownload(assets, 'Mozilla/5.0 (X11; Linux x86_64)')).toBeNull()
    expect(pickCreatorHubDownload([], WINDOWS_UA)).toBeNull()
  })
})

describe('startCreatorHubDownload', () => {
  const assign = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('location', { ...window.location, assign })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("reports the start with sites' funnel props, then opens sites' success page", () => {
    const href = 'https://example.com/creator-hub-mac-arm64.dmg'
    startCreatorHubDownload({ os: 'macOS', arch: 'arm64', href })

    expect(sendOverviewTrack).toHaveBeenCalledWith(
      'download_started',
      expect.objectContaining({
        download_target: 'creator_hub',
        place: 'creators-hero',
        href,
        os: 'macOS',
        arch: 'arm64',
        auth_state: 'anonymous',
        revisit: 0,
        anon_user_id: 'anon-1'
      })
    )
    expect(assign).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SUCCESS_REDIRECT_DELAY_MS)
    expect(assign).toHaveBeenCalledWith(
      'https://decentraland.zone/download/creator-hub-success?os=macOS&arch=arm64&anon_user_id=anon-1'
    )
  })
})
