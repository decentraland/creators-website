import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '~/config'
import { buildCollectionPreviewDeepLink, launchCollectionPreview, previewCollection } from './explorer'
import { openExternal, openProtocolLink } from './navigation'

vi.mock('./navigation', () => ({ openExternal: vi.fn(), openProtocolLink: vi.fn() }))

describe('buildCollectionPreviewDeepLink', () => {
  it('deep-links the desktop client to the collection self-preview in the preview world with the backpack open', () => {
    const url = new URL(buildCollectionPreviewDeepLink('col-1'))
    expect(url.protocol).toBe('decentraland:')
    expect(url.searchParams.get('self-preview-builder-collections')).toBe('col-1')
    expect(url.searchParams.get('realm')).toBe('district.dcl.eth')
    expect(url.searchParams.get('force-open-backpack')).toBe('true')
    expect(url.searchParams.has('position')).toBe(false)
  })

  it('targets the development environment', () => {
    const url = new URL(buildCollectionPreviewDeepLink('col-1'))
    expect(url.searchParams.get('dclenv')).toBe('zone')
  })
})

describe('launchCollectionPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(openProtocolLink).mockReset()
    vi.mocked(openExternal).mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('reports success when the tab loses focus after opening the deep link', async () => {
    const launched = launchCollectionPreview('col-1')
    expect(openProtocolLink).toHaveBeenCalledWith(expect.stringContaining('self-preview-builder-collections=col-1'))

    window.dispatchEvent(new Event('blur'))
    await vi.runAllTimersAsync()
    await expect(launched).resolves.toBe(true)
  })

  it('reports failure when nothing takes over the tab within the timeout', async () => {
    const launched = launchCollectionPreview('col-1', { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)
    await expect(launched).resolves.toBe(false)
  })

  it('reports failure when the browser refuses the protocol navigation', async () => {
    vi.mocked(openProtocolLink).mockImplementation(() => {
      throw new Error('blocked')
    })
    await expect(launchCollectionPreview('col-1')).resolves.toBe(false)
  })

  it('sends the user to the download page when no desktop client picks up the link', async () => {
    const done = previewCollection('col-1')
    await vi.runAllTimersAsync()
    await done
    expect(openExternal).toHaveBeenCalledWith(config.get('DOWNLOAD_URL'))
  })

  it('does not open the download page once the desktop client took over', async () => {
    const done = previewCollection('col-1')
    window.dispatchEvent(new Event('blur'))
    await vi.runAllTimersAsync()
    await done
    expect(openExternal).not.toHaveBeenCalled()
  })
})
