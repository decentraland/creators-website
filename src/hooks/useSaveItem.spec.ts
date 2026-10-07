import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchContent } from '~/lib/builder'
import { captureError } from '~/lib/monitoring'
import { ItemType, type Item } from '~/lib/items'
import { buildSaveItem, fetchStoredThumbnail, wasImageRefreshSkipped } from './useSaveItem'

vi.mock('~/lib/builder', () => ({ fetchContent: vi.fn(), saveItem: vi.fn() }))
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))

const item: Item = {
  id: 'w1',
  name: 'Hat',
  description: '',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  rarity: 'epic',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: { category: 'hat', hides: [], replaces: [], tags: [], representations: [] },
  contents: { 'male/hat.glb': 'bafyglb', 'thumbnail.png': 'bafythumb', 'image.png': 'bafyimage' },
  createdAt: 1,
  updatedAt: 1
}
const png = () => new Blob(['png'], { type: 'image/png' })

beforeEach(() => {
  vi.mocked(fetchContent).mockReset()
  vi.mocked(captureError).mockReset()
})

describe('buildSaveItem', () => {
  it('rebuilds only the catalyst image from the stored thumbnail when the rarity went stale', async () => {
    vi.mocked(fetchContent).mockResolvedValue(png())
    const { item: built, blobs } = await buildSaveItem({ item, imageStale: true })
    expect(fetchContent).toHaveBeenCalledWith('bafythumb')
    expect(Object.keys(blobs)).toEqual(['image.png'])
    expect(built.contents['image.png']).not.toBe('bafyimage')
    expect(built.contents['thumbnail.png']).toBe('bafythumb')
  })

  it('lets a new thumbnail win over a stale image: both files come from the new picture', async () => {
    const { blobs } = await buildSaveItem({ item, thumbnail: png(), imageStale: true })
    expect(fetchContent).not.toHaveBeenCalled()
    expect(Object.keys(blobs).sort()).toEqual(['image.png', 'thumbnail.png'])
  })

  it('saves as is when nothing about the picture changed', async () => {
    const { blobs } = await buildSaveItem({ item, blobs: { 'male/hat.glb': new Blob(['glb']) } })
    expect(fetchContent).not.toHaveBeenCalled()
    expect(Object.keys(blobs)).toEqual(['male/hat.glb'])
  })
})

describe('fetchStoredThumbnail', () => {
  it('is null for an item without a stored thumbnail, without touching storage', async () => {
    expect(await fetchStoredThumbnail({ ...item, contents: { 'male/hat.glb': 'bafyglb' } })).toBeNull()
    expect(fetchContent).not.toHaveBeenCalled()
  })

  it('reports a storage failure and lets the save go on without the image', async () => {
    vi.mocked(fetchContent).mockRejectedValue(new Error('storage down'))
    expect(await fetchStoredThumbnail(item)).toBeNull()
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { flow: 'save-item', itemId: 'w1' })
    const variables = { item, imageStale: true }
    const built = await buildSaveItem(variables)
    expect(built.blobs).toEqual({})
    expect(wasImageRefreshSkipped(variables, built)).toBe(true)
  })

  it('does not count a save with a new thumbnail, or one with the image rebuilt, as skipped', async () => {
    vi.mocked(fetchContent).mockResolvedValue(png())
    const stale = { item, imageStale: true }
    expect(wasImageRefreshSkipped(stale, await buildSaveItem(stale))).toBe(false)
    const fresh = { item, thumbnail: png(), imageStale: true }
    expect(wasImageRefreshSkipped(fresh, await buildSaveItem(fresh))).toBe(false)
  })
})
