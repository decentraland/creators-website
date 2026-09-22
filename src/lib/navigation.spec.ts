import { afterEach, describe, expect, it, vi } from 'vitest'
import { openExternal, redirectExternal } from './navigation'

describe('openExternal', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens the url in a new, isolated tab', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    openExternal('https://example.com')
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })
})

describe('redirectExternal', () => {
  it('leaves the app in the current tab', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    redirectExternal('https://checkout.example/cs_1')
    expect(assign).toHaveBeenCalledWith('https://checkout.example/cs_1')
    vi.unstubAllGlobals()
  })
})
