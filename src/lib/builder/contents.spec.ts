import { describe, it, expect, vi } from 'vitest'
import { type Item } from '~/lib/items'
import { fetchItemContents, getContentsStorageUrl } from './contents'

describe('getContentsStorageUrl', () => {
  it('builds the storage URL for a content hash', () => {
    expect(getContentsStorageUrl('Qmx')).toBe('https://builder-api.decentraland.zone/v1/storage/contents/Qmx')
  })
})

describe('fetchItemContents', () => {
  const item = {
    id: 'item-1',
    contents: { 'male/model.glb': 'QmModel', 'thumbnail.png': 'QmThumb' }
  } as unknown as Item

  it('downloads every file from public storage keyed by its path', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(url.endsWith('QmModel') ? 'model' : 'thumb'))
    vi.stubGlobal('fetch', fetchMock)
    const contents = await fetchItemContents(item)
    expect(Object.keys(contents).sort()).toEqual(['male/model.glb', 'thumbnail.png'])
    expect(await contents['male/model.glb'].text()).toBe('model')
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(getContentsStorageUrl('QmThumb'))
    vi.unstubAllGlobals()
  })

  it('fails when any file cannot be downloaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 }))
    )
    await expect(fetchItemContents(item)).rejects.toThrow(/404/)
    vi.unstubAllGlobals()
  })
})
