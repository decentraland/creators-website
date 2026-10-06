// @vitest-environment-options {"url":"http://localhost/"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnonymousIdResolver } from './segmentAnonymousId.helpers'

describe('when creating browser identity on localhost', () => {
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
    expect(write).not.toContain('domain=')
  })
})
