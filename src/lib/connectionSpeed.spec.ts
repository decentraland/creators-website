import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureDownlinkMbps, PROBE_URL } from './connectionSpeed'

const PROBE_BYTES = 262_144

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function clockAdvancing(ms: number) {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => {
    const value = now
    now += ms
    return value
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('measureDownlinkMbps', () => {
  it('downloads the probe uncached and reports its throughput', async () => {
    clockAdvancing(200)
    const fetchMock = stubFetch(() => Promise.resolve(new Response(new Uint8Array(PROBE_BYTES))))
    expect(await measureDownlinkMbps()).toBeCloseTo((PROBE_BYTES * 8) / 1e6 / 0.2, 2)
    expect(fetchMock).toHaveBeenCalledWith(PROBE_URL, expect.objectContaining({ cache: 'no-store' }))
  })

  it('reads a timed-out probe as a slow link', async () => {
    stubFetch(() => Promise.reject(new DOMException('timed out', 'TimeoutError')))
    expect(await measureDownlinkMbps()).toBe(0)
  })

  it('reads a failed, rejected or truncated probe as unknown', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await measureDownlinkMbps()).toBeNull()
    stubFetch(() => Promise.resolve(new Response('', { status: 404 })))
    expect(await measureDownlinkMbps()).toBeNull()
    stubFetch(() => Promise.resolve(new Response(new Uint8Array(10))))
    expect(await measureDownlinkMbps()).toBeNull()
  })
})
