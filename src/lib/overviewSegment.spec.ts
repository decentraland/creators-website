import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendDirect } from '~/lib/analytics'

const settings = vi.hoisted((): { values: Record<string, string> } => ({ values: {} }))
vi.mock('~/config', () => ({ config: { get: (key: string, fallback = '') => settings.values[key] ?? fallback } }))
vi.mock('~/lib/analytics', () => ({ sendDirect: vi.fn() }))

const APP_KEY = 'app-write-key-example'
const SITES_KEY = 'sites-write-key-example'

/** A fresh module, since the fallback warning is shown once per page load. */
async function loadSender() {
  vi.resetModules()
  return import('./overviewSegment')
}

beforeEach(() => {
  settings.values = { SEGMENT_API_KEY: APP_KEY, SITES_SEGMENT_API_KEY: SITES_KEY }
  vi.mocked(sendDirect).mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z') })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sendOverviewTrack', () => {
  it('sends to sites’ Segment source with sites’ delivery fields', async () => {
    const { sendOverviewTrack } = await loadSender()
    sendOverviewTrack('Click', { place: 'Creators Hero' })

    const at = new Date('2026-09-25T12:00:00Z').getTime()
    expect(sendDirect).toHaveBeenCalledWith(
      SITES_KEY,
      { type: 'track', event: 'Click' },
      { place: 'Creators Hero', track_called_at: at, track_delivered_at: at, track_deferred: false }
    )
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('falls back to this app’s source without the sites key, warning once', async () => {
    settings.values.SITES_SEGMENT_API_KEY = ''
    const { sendOverviewTrack, sendOverviewPage } = await loadSender()
    sendOverviewTrack('Section Viewed', { section_viewed: 'Creators Why', mobile: false })
    sendOverviewPage('/create')

    expect(sendDirect).toHaveBeenNthCalledWith(
      1,
      APP_KEY,
      { type: 'track', event: 'Section Viewed' },
      expect.objectContaining({ section_viewed: 'Creators Why' })
    )
    expect(sendDirect).toHaveBeenNthCalledWith(2, APP_KEY, { type: 'page', name: '/create' })
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})

describe('sendOverviewPage', () => {
  it('sends the page view to sites’ source', async () => {
    const { sendOverviewPage } = await loadSender()
    sendOverviewPage('/create')
    expect(sendDirect).toHaveBeenCalledWith(SITES_KEY, { type: 'page', name: '/create' })
  })
})
