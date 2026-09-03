import { afterEach, describe, expect, it, vi } from 'vitest'
import { openExternal } from './navigation'

describe('openExternal', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens the url in a new, isolated tab', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    openExternal('https://example.com')
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })
})
