import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendOverviewTrack } from '~/lib/overviewSegment'
import { HttpError } from '~/lib/http'
import {
  cancelCreatorHubRedirect,
  fetchCreatorHubAssets,
  pickCreatorHubDownload,
  startCreatorHubDownload,
  SUCCESS_REDIRECT_DELAY_MS
} from './creatorHubDownload'

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

describe('fetchCreatorHubAssets', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("reads the latest release's assets", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ assets }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchCreatorHubAssets()).resolves.toEqual(assets)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/decentraland/creator-hub/releases/latest',
      expect.anything()
    )
  })

  it('treats a release without assets as no installers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
    await expect(fetchCreatorHubAssets()).resolves.toEqual([])
  })

  it('fails on a non-ok response, releasing its body', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, body: { cancel } }))
    await expect(fetchCreatorHubAssets()).rejects.toBeInstanceOf(HttpError)
    expect(cancel).toHaveBeenCalled()
  })
})

describe('pickCreatorHubDownload', () => {
  it('picks the Windows installer on Windows', () => {
    expect(pickCreatorHubDownload(assets, WINDOWS_UA, 0)).toEqual({
      os: 'Windows',
      arch: 'amd64',
      href: 'https://example.com/creator-hub-win-x64.exe'
    })
  })

  it('picks the Apple Silicon build on a Mac, and the Intel one when that is all the release has', () => {
    expect(pickCreatorHubDownload(assets, MAC_UA, 0)?.href).toBe('https://example.com/creator-hub-mac-arm64.dmg')
    expect(pickCreatorHubDownload([asset('creator-hub-mac-x64.dmg')], MAC_UA, 0)).toEqual({
      os: 'macOS',
      arch: 'amd64',
      href: 'https://example.com/creator-hub-mac-x64.dmg'
    })
  })

  it('offers nothing where no installer ships', () => {
    expect(pickCreatorHubDownload(assets, 'Mozilla/5.0 (X11; Linux x86_64)', 0)).toBeNull()
    expect(pickCreatorHubDownload([], WINDOWS_UA, 0)).toBeNull()
    // iPadOS Safari: a Mac user agent on a touch screen.
    expect(pickCreatorHubDownload(assets, MAC_UA, 5)).toBeNull()
  })
})

describe('startCreatorHubDownload', () => {
  const assign = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('location', { ...window.location, assign })
  })
  afterEach(() => {
    cancelCreatorHubRedirect()
    vi.mocked(sendOverviewTrack).mockClear()
    assign.mockClear()
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

  it('starts one download per pending redirect, so a double click counts once', () => {
    const download = { os: 'Windows', arch: 'amd64', href: 'https://example.com/creator-hub-win-x64.exe' } as const
    startCreatorHubDownload(download)
    startCreatorHubDownload(download)
    vi.advanceTimersByTime(SUCCESS_REDIRECT_DELAY_MS)
    expect(sendOverviewTrack).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('stays on the page when the visitor leaves before the redirect', () => {
    startCreatorHubDownload({ os: 'Windows', arch: 'amd64', href: 'https://example.com/creator-hub-win-x64.exe' })
    cancelCreatorHubRedirect()
    vi.advanceTimersByTime(SUCCESS_REDIRECT_DELAY_MS)
    expect(assign).not.toHaveBeenCalled()
  })
})
