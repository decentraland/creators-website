// @vitest-environment-options {"url":"https://anon-preview.vercel.app/"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnonymousIdResolver } from './segmentAnonymousId.helpers'

describe('when creating browser identity on preview', () => {
  let writes: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    writes = vi.spyOn(document, 'cookie', 'set')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.cookie = 'ajs_anonymous_id=; path=/; max-age=0'
  })
  it('should use the writable scope without sharing through a public suffix', () => {
    const id = createAnonymousIdResolver(() => undefined).ensure()
    expect(document.cookie).toContain(`ajs_anonymous_id=${id}`)
    const write = writes.mock.calls.find(([value]: unknown[]) => String(value).startsWith('ajs_anonymous_id='))?.[0]
    expect(write).toContain(`domain=.${'anon-preview.vercel.app'}`)
    expect(document.cookie).not.toContain('__dcl_segment_domain__')
  })
})
