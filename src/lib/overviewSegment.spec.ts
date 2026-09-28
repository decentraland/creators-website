import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendDirect } from '~/lib/analytics'

const settings = vi.hoisted((): { values: Record<string, string> } => ({ values: {} }))
vi.mock('~/config', () => ({ config: { get: (key: string, fallback = '') => settings.values[key] ?? fallback } }))
vi.mock('~/lib/analytics', () => ({ sendDirect: vi.fn() }))

const SITES_KEY = 'sites-write-key-example'

const loadSender = () => import('./overviewSegment')

beforeEach(() => {
  settings.values = { SITES_SEGMENT_API_KEY: SITES_KEY }
  vi.mocked(sendDirect).mockClear()
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
  })
})

describe('sendOverviewPage', () => {
  it('sends the page view to sites’ source', async () => {
    const { sendOverviewPage } = await loadSender()
    sendOverviewPage('/create')
    expect(sendDirect).toHaveBeenCalledWith(SITES_KEY, { type: 'page', name: '/create' })
  })
})
