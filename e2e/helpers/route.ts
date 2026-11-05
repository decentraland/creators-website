import { type HTTPRequest } from 'puppeteer'
import { type BuilderServer } from './builderServer'
import { handleRpc } from './rpc'

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
}

// 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

export type Flags = Record<string, boolean>
export type Variants = Record<string, string>
export type ForcedErrors = Record<string, { status: number; body?: unknown }>

export type RouteContext = {
  appOrigin: string
  builder: BuilderServer
  flags: Flags
  variants: Variants
  errors: ForcedErrors
  /** Builder storage files by content hash. */
  storage: Record<string, Buffer>
  data: ExternalData
}

export type ExternalData = {
  hotScenes: unknown[]
  blogPosts: unknown[]
}

export const DEFAULT_EXTERNAL_DATA: ExternalData = {
  hotScenes: [
    {
      id: 'scene-1',
      name: 'Neon Rooftop',
      baseCoords: [10, 20],
      usersTotalCount: 12,
      parcels: [[10, 20]],
      thumbnail: 'https://e2e.invalid/scene-1.png'
    },
    {
      id: 'scene-2',
      name: 'Pixel Gallery',
      baseCoords: [-5, 33],
      usersTotalCount: 4,
      parcels: [[-5, 33]],
      thumbnail: 'https://e2e.invalid/scene-2.png'
    }
  ],
  blogPosts: [
    {
      sys: { id: 'post-1' },
      fields: { id: 'creator-spotlight', title: 'Creator spotlight', publishedDate: '2026-10-30T00:00:00.000Z' }
    }
  ]
}

const json = (req: HTTPRequest, body: unknown, status = 200) =>
  req.respond({ status, headers: { 'content-type': 'application/json', ...CORS }, body: JSON.stringify(body) })

const empty = (req: HTTPRequest, contentType = 'text/plain') =>
  req.respond({ status: 200, headers: { 'content-type': contentType, ...CORS }, body: '' })

function parseBody(req: HTTPRequest): unknown {
  const raw = req.postData()
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Answers every request the page makes: the app's own assets pass through, everything else is mocked. */
export function route(req: HTTPRequest, ctx: RouteContext): Promise<void> {
  const url = new URL(req.url())
  const { hostname, pathname } = url
  const method = req.method()

  if (url.origin === ctx.appOrigin || url.protocol === 'data:' || url.protocol === 'blob:') return req.continue()
  // A failed preflight would surface as "Failed to fetch" and hide the forced error the spec asked for.
  if (method === 'OPTIONS') return req.respond({ status: 204, headers: CORS })

  const forced = Object.entries(ctx.errors).find(([path]) => pathname.endsWith(path))
  if (forced) return json(req, forced[1].body ?? { ok: false, error: 'forced e2e error' }, forced[1].status)

  if (hostname.startsWith('feature-flags.')) {
    return json(req, {
      flags: ctx.flags,
      variants: Object.fromEntries(
        Object.entries(ctx.variants).map(([flag, value]) => [flag, { enabled: true, payload: { value } }])
      )
    })
  }

  if (hostname.startsWith('builder-api.')) {
    const path = pathname.replace(/^\/v1/, '')
    const storage = path.match(/^\/storage\/contents\/(.+)$/)
    if (storage) {
      const file = ctx.storage[storage[1]]
      return file
        ? req.respond({ status: 200, headers: { 'content-type': 'application/octet-stream', ...CORS }, body: file })
        : req.respond({ status: 404, headers: CORS, body: '' })
    }
    const answer = ctx.builder.handle(method, path, url.searchParams, parseBody(req))
    if (answer) return json(req, answer.body, answer.status)
    process.stderr.write(`[e2e] unmocked builder-server route: ${method} ${path}\n`)
    return json(req, { ok: false, error: 'unmocked e2e route' }, 501)
  }

  if (hostname.startsWith('peer.')) {
    if (pathname.startsWith('/lambdas/profiles/')) return json(req, { avatars: [] })
    if (pathname.startsWith('/content/contents/')) return req.respond({ status: 200, headers: CORS, body: PNG })
    return json(req, [])
  }

  if (hostname.startsWith('realm-provider')) return json(req, ctx.data.hotScenes)

  if (hostname === 'cms-api.decentraland.org') {
    if (pathname.endsWith('/blog/posts'))
      return json(req, { items: ctx.data.blogPosts, total: ctx.data.blogPosts.length })
    if (pathname.endsWith('/blog/categories')) return json(req, { items: [] })
    // No campaign and no cover assets unless a spec serves them.
    return json(req, {}, 404)
  }

  if (hostname === 'api.github.com') return json(req, { assets: [] })

  if (hostname.startsWith('credits.') && /^\/users\/[^/]+\/credits$/.test(pathname)) {
    return json(req, { usd: { balanceCents: 0, credits: 0 } })
  }

  // The read-only provider and the relayer: no chain is ever reached.
  if (hostname.startsWith('rpc-') || hostname.includes('rpc.') || pathname.includes('/rpc')) {
    return json(req, handleRpc(req.postData() ?? '{}'))
  }

  // Monitoring and analytics sinks. analytics.js is served empty, so tracked calls stay in the snippet's queue.
  if (hostname.endsWith('sentry.io') || hostname.startsWith('api.e.')) return empty(req)
  if (hostname.startsWith('evs.e.') || hostname === 'cdn.segment.com') return empty(req, 'application/javascript')
  if (hostname.includes('intercom')) return empty(req, 'application/javascript')

  // The preview iframe can't run Unity/Babylon headless. This page posts the LOAD message the real one sends.
  if (hostname.startsWith('wearable-preview')) {
    return req.respond({
      status: 200,
      headers: { 'content-type': 'text/html', ...CORS },
      body:
        '<!doctype html><title>preview</title><script>' +
        'var m={type:"load",payload:{renderer:"babylon"}};' +
        'var n=0,i=setInterval(function(){parent.postMessage(m,"*");if(++n>20)clearInterval(i)},100);' +
        'parent.postMessage(m,"*");' +
        '</script>'
    })
  }

  const type = req.resourceType()
  if (type === 'image')
    return req.respond({ status: 200, headers: { 'content-type': 'image/png', ...CORS }, body: PNG })
  if (type === 'font' || type === 'media' || type === 'stylesheet') return empty(req)
  // Third-party embeds (the footer's newsletter form) and top-level navigations away from the app both need
  // HTML: anything else makes a navigation a download.
  if (type === 'document') {
    return req.respond({
      status: 200,
      headers: { 'content-type': 'text/html', ...CORS },
      body: '<!doctype html><title>external</title>'
    })
  }

  process.stderr.write(`[e2e] unmocked request: ${method} ${req.url()}\n`)
  return json(req, {}, 404)
}
