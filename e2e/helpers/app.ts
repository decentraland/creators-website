import puppeteer, { type Browser, type Page } from 'puppeteer'
import { createBuilderServer, type BuilderSeed, type BuilderServer } from './builderServer'
import { BASE } from './env'
import { DEFAULT_EXTERNAL_DATA, route, type ExternalData, type Flags, type ForcedErrors, type Variants } from './route'
import { OFFLINE_WEBSOCKET_SCRIPT, POLYGON_AMOY, sessionInitScript, testSession } from './session'

export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true }
} as const

export type TrackedEvent = { event: string; props: Record<string, unknown> }

export type App = {
  browser: Browser
  page: Page
  builder: BuilderServer
  /** Every write the app sent to a mocked service (`METHOD /path`), in order; chain reads and analytics excluded. */
  writes: string[]
  /** The Segment `track` calls made so far, through analytics.js or the direct HTTP beacon. */
  events: () => Promise<TrackedEvent[]>
  /** Resolves with the first tracked `event` whose props match, polling until `timeout`. */
  waitForEvent: (event: string, match?: Record<string, unknown>, timeout?: number) => Promise<TrackedEvent>
  close: () => Promise<void>
}

export type LaunchOptions = {
  path?: string
  signedOut?: boolean
  builder?: BuilderSeed
  /** Flag values served by the flag service, keyed `${application}-${flag}`. Everything else is off. */
  flags?: Flags
  variants?: Variants
  errors?: ForcedErrors
  /** Builder storage files by content hash. */
  storage?: Record<string, Buffer>
  data?: Partial<ExternalData>
  chainId?: number
  viewport?: keyof typeof VIEWPORTS
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
}

/** A headless page on the e2e dev server with the wallet and every off-origin request mocked. */
export async function launchApp(opts: LaunchOptions = {}): Promise<App> {
  const builder = createBuilderServer(opts.builder)
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // CI machines report no hover and a coarse pointer, which would run every hover rule's touch branch.
      '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'
    ]
  })
  const page = await browser.newPage()
  await page.setViewport(VIEWPORTS[opts.viewport ?? 'desktop'])
  // isbot reads "HeadlessChrome" as a crawler, and the app turns analytics off for crawlers.
  await page.setUserAgent((await browser.userAgent()).replace('HeadlessChrome', 'Chrome'))
  await page.evaluateOnNewDocument(OFFLINE_WEBSOCKET_SCRIPT)
  if (!opts.signedOut) {
    await page.evaluateOnNewDocument(sessionInitScript(await testSession(), opts.chainId ?? POLYGON_AMOY))
  }

  const writes: string[] = []
  const beaconEvents: TrackedEvent[] = []
  const ctx = {
    appOrigin: new URL(BASE).origin,
    builder,
    flags: opts.flags ?? {},
    variants: opts.variants ?? {},
    errors: opts.errors ?? {},
    storage: opts.storage ?? {},
    data: { ...DEFAULT_EXTERNAL_DATA, ...opts.data }
  }
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = new URL(req.url())
    const body = req.postData() ?? ''
    if (url.hostname.startsWith('api.e.') && url.pathname.endsWith('/track')) {
      // A sendBeacon body is a Blob, which Chrome doesn't inline into the request event.
      void (req.hasPostData() && !body ? req.fetchPostData() : Promise.resolve(body)).then(raw => {
        const call = JSON.parse(raw || '{}') as { event?: string; properties?: Record<string, unknown> }
        if (call.event) beaconEvents.push({ event: call.event, props: call.properties ?? {} })
      })
    } else if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method()) &&
      url.origin !== ctx.appOrigin &&
      !body.includes('"jsonrpc"') &&
      !url.hostname.startsWith('api.e.') &&
      !url.hostname.endsWith('sentry.io')
    ) {
      writes.push(`${req.method()} ${url.pathname}`)
    }
    route(req, ctx).catch(() => {})
  })

  await page.goto(`${BASE}${opts.path ?? '/'}`, { waitUntil: opts.waitUntil ?? 'networkidle2', timeout: 45_000 })

  // analytics.js is served empty, so its snippet keeps every queued call.
  const events = async () => {
    const queued = await page.evaluate(() => {
      const queue = (window as unknown as { analytics?: unknown[] }).analytics
      if (!Array.isArray(queue)) return []
      return queue
        .filter((call): call is unknown[] => Array.isArray(call) && call[0] === 'track')
        .map(call => ({ event: call[1] as string, props: (call[2] ?? {}) as Record<string, unknown> }))
    })
    return [...beaconEvents, ...queued]
  }

  const waitForEvent = async (event: string, match: Record<string, unknown> = {}, timeout = 10_000) => {
    const deadline = Date.now() + timeout
    for (;;) {
      const found = (await events()).find(
        e => e.event === event && Object.entries(match).every(([key, value]) => e.props[key] === value)
      )
      if (found) return found
      if (Date.now() > deadline) throw new Error(`no "${event}" event matching ${JSON.stringify(match)}`)
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return { browser, page, builder, writes, events, waitForEvent, close: () => browser.close() }
}
