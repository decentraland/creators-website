import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError, fetchOrNetworkError, isNetworkError } from './http'

afterEach(() => vi.unstubAllGlobals())

describe('fetchOrNetworkError', () => {
  it('turns a request that never got a response into a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await fetchOrNetworkError('https://feed.example.com').catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(true)
  })

  it('keeps a timeout recognizable as one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError')))
    const error = await fetchOrNetworkError('https://feed.example.com').catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(true)
  })
})

describe('isNetworkError', () => {
  it('recognizes timeouts and aborts', () => {
    expect(isNetworkError(new DOMException('signal timed out', 'TimeoutError'))).toBe(true)
    expect(isNetworkError(new DOMException('aborted', 'AbortError'))).toBe(true)
  })

  it('leaves server errors and bugs to be reported', () => {
    expect(isNetworkError(new HttpError('feed', 503))).toBe(false)
    expect(isNetworkError(new TypeError("Cannot read properties of null (reading 'items')"))).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})
