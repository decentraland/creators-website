import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120'
const WRITE_KEY = 'segment-write-key-test'
const PROXY_URL = 'https://proxy.example.com/abc/def.min.js'

const wallet = vi.hoisted(() => ({ session: null as { address: string } | null }))

const settings = vi.hoisted((): { values: Record<string, string | undefined> } => ({ values: {} }))
vi.mock('~/config', () => ({
  config: { get: (key: string, fallback = '') => settings.values[key] ?? fallback },
  APP_VERSION: '1.2.3'
}))

function segmentStub() {
  return {
    track: vi.fn(),
    identify: vi.fn(),
    page: vi.fn(),
    reset: vi.fn(),
    ready: vi.fn((cb: () => void) => cb()),
    user: vi.fn(() => ({ anonymousId: () => 'anon-1' }))
  }
}

/** A fresh module graph, since the bot check and the load latch are decided at import time. */
async function loadAnalytics(userAgent = BROWSER_USER_AGENT) {
  vi.resetModules()
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true })
  // The wallet store registers this in the app; here the test plays that part.
  const { setCurrentAddressReader } = await import('./currentAddress')
  setCurrentAddressReader(() => wallet.session?.address)
  return import('./analytics')
}

beforeEach(() => {
  wallet.session = null
  settings.values = {
    ENVIRONMENT: 'development',
    SEGMENT_API_KEY: WRITE_KEY,
    SEGMENT_ANALYTICS_URL: PROXY_URL
  }
  document.head.innerHTML = ''
  delete (window as { analytics?: unknown }).analytics
})

afterEach(() => vi.restoreAllMocks())

describe('track', () => {
  it('sends the event with the signed-in creator and the source that tells this app from the legacy builder', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics
    wallet.session = { address: '0xCreAtoR' }

    const { track } = await loadAnalytics()
    track('Publish collection', { collectionId: 'col-1' })

    expect(analytics.track).toHaveBeenCalledWith(
      'Publish collection',
      expect.objectContaining({
        source: 'wemotes-builder',
        version: '1.2.3',
        collectionId: 'col-1',
        address: '0xCreAtoR',
        is_signed_in: true,
        app_env: 'development'
      })
    )
  })

  it('reports a visitor who has not signed in as anonymous', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { track } = await loadAnalytics()
    track('Login')

    expect(analytics.track).toHaveBeenCalledWith(
      'Login',
      expect.objectContaining({ address: null, is_signed_in: false })
    )
  })

  it('keeps its own source even when an event passes one', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { track } = await loadAnalytics()
    track('Add items', { source: 'somewhere-else' })

    expect(analytics.track.mock.calls[0][1]).toMatchObject({ source: 'wemotes-builder' })
  })

  it('sends nothing at all from a crawler', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { track, identify, trackPage, initAnalytics } = await loadAnalytics(BOT_USER_AGENT)
    initAnalytics()
    track('Login')
    identify('0xabc')
    trackPage('collections')

    expect(analytics.track).not.toHaveBeenCalled()
    expect(analytics.identify).not.toHaveBeenCalled()
    expect(analytics.page).not.toHaveBeenCalled()
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('does not throw when analytics never loaded', async () => {
    const { track } = await loadAnalytics()
    expect(() => track('Login')).not.toThrow()
  })
})

describe('identify', () => {
  it('identifies the creator by a lowercased address and forgets them on sign-out', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { identify, reset } = await loadAnalytics()
    identify('0xABCDEF', { provider_type: 'injected' })
    reset()

    expect(analytics.identify).toHaveBeenCalledWith('0xabcdef', expect.objectContaining({ provider_type: 'injected' }))
    expect(analytics.reset).toHaveBeenCalled()
  })

  it('never tags the creator with a source, which would outlive the app they used', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { identify } = await loadAnalytics()
    identify('0xabc', { chainId: 137 })

    expect(analytics.identify).toHaveBeenCalledWith('0xabc', { chainId: 137 })
  })
})

describe('trackPage', () => {
  it('records the page under its stable name', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { trackPage } = await loadAnalytics()
    trackPage('collection_detail')

    expect(analytics.page).toHaveBeenCalledWith(
      'collection_detail',
      expect.objectContaining({ source: 'wemotes-builder' })
    )
  })
})

describe('initAnalytics', () => {
  it('loads analytics.js from the first party proxy, settings included', async () => {
    const { initAnalytics } = await loadAnalytics()
    initAnalytics()

    const script = document.head.querySelector('script')
    expect(script?.src).toBe(PROXY_URL)
    // Without _cdn, analytics.js would still fetch its settings from Segment's CDN — and lose them to ad blockers.
    expect((window as unknown as { analytics: { _cdn?: string } }).analytics._cdn).toBe('https://proxy.example.com')
  })

  it('falls back to Segment’s own CDN when the proxy is not configured or unusable', async () => {
    settings.values.SEGMENT_ANALYTICS_URL = 'not a url'
    const { initAnalytics } = await loadAnalytics()
    initAnalytics()

    const script = document.head.querySelector('script')
    expect(script?.src).toBe(`https://cdn.segment.com/analytics.js/v1/${WRITE_KEY}/analytics.min.js`)
    expect((window as unknown as { analytics: { _cdn?: string } }).analytics._cdn).toBeUndefined()
  })

  it('stays off without a write key, so local runs never send', async () => {
    settings.values.SEGMENT_API_KEY = ''
    const { initAnalytics, track } = await loadAnalytics()
    initAnalytics()
    track('Login')

    expect(document.head.querySelector('script')).toBeNull()
    expect((window as { analytics?: unknown }).analytics).toBeUndefined()
  })

  it('names this app in Segment’s own context.app, so page and identify calls carry it too', async () => {
    type Payload = { obj: { context: Record<string, unknown> } }
    type Middleware = (params: { payload: Payload; next: (payload: Payload) => void }) => void
    const addSourceMiddleware = vi.fn<(middleware: Middleware) => void>()
    ;(window as unknown as { analytics: unknown }).analytics = {
      ...segmentStub(),
      initialize: true,
      addSourceMiddleware
    }

    const { initAnalytics } = await loadAnalytics()
    initAnalytics()

    const middleware = addSourceMiddleware.mock.calls[0][0]
    const payload: Payload = { obj: { context: {} } }
    const next = vi.fn()
    middleware({ payload, next })

    expect(payload.obj.context.app).toEqual({ name: 'wemotes-builder', version: '1.2.3' })
    expect(next).toHaveBeenCalledWith(payload)
  })

  it('queues events made before analytics.js has loaded and loads only once', async () => {
    const { initAnalytics, track } = await loadAnalytics()
    initAnalytics()
    track('Login')
    initAnalytics()

    const queue = (window as unknown as { analytics: unknown[] }).analytics
    expect(queue.some(entry => Array.isArray(entry) && entry[0] === 'track')).toBe(true)
    expect(document.head.querySelectorAll('script')).toHaveLength(1)
  })
})

describe('getAnonymousId', () => {
  it('hands out the id Intercom is stitched with, once analytics is ready', async () => {
    const analytics = segmentStub()
    ;(window as unknown as { analytics: unknown }).analytics = analytics

    const { getAnonymousId, onAnalyticsReady } = await loadAnalytics()
    const ready = vi.fn()
    onAnalyticsReady(ready)

    expect(ready).toHaveBeenCalled()
    expect(getAnonymousId()).toBe('anon-1')
  })
})

describe('errorCode', () => {
  it('reports the failure reason the flow already branches on, never the raw message', async () => {
    const { errorCode } = await loadAnalytics()
    const failure = Object.assign(new Error('collection 0x123 is locked'), { reason: 'locked' })

    expect(errorCode(failure)).toBe('locked')
  })

  it('separates a dismissed wallet prompt from a real failure', async () => {
    const { errorCode } = await loadAnalytics()

    expect(errorCode(Object.assign(new Error('nope'), { code: 4001 }))).toBe('rejected')
    expect(errorCode(new Error('something exploded'))).toBe('unknown')
  })
})
