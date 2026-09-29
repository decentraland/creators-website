import { describe, expect, it, vi } from 'vitest'
import { type Collection } from './collections'
import { BODY_SHAPE_MALE, ItemType, type Item } from './items'
import { buildStaticCheckInput, runStaticChecks, toStaticFinding, withPublishedIdentity } from './staticChecks'

const collection = {
  id: 'c1',
  name: 'Hats',
  urn: 'urn:decentraland:amoy:collections-v2:0xcollection',
  contractAddress: '0xcollection',
  isPublished: false,
  isApproved: false
} as Collection

function item(id: string, createdAt: number, overrides: Partial<Item> = {}): Item {
  return {
    id,
    name: `Item ${id}`,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: '0xowner',
    rarity: 'common',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: {
      category: 'hat',
      representations: [{ bodyShapes: [BODY_SHAPE_MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] }],
      hides: [],
      replaces: [],
      tags: []
    },
    metrics: { triangles: 10 },
    contents: {
      'male/hat.glb': 'bafyglb',
      'thumbnail.png': 'bafythumb',
      'image.png': 'bafyimage',
      'video.mp4': 'bafyvideo'
    },
    createdAt,
    updatedAt: createdAt,
    ...overrides
  }
}

describe('withPublishedIdentity', () => {
  it('numbers the items by creation order, like createCollection will, and keeps published ids', () => {
    const [second, first, published] = withPublishedIdentity(collection, [
      item('b', 20),
      item('a', 10),
      item('p', 5, { tokenId: '7', urn: 'urn:x:7' })
    ])
    expect(first).toMatchObject({ tokenId: '1', urn: `${collection.urn}:1` })
    expect(second).toMatchObject({ tokenId: '2', urn: `${collection.urn}:2` })
    expect(published).toMatchObject({ tokenId: '7', urn: 'urn:x:7' })
  })
})

describe('buildStaticCheckInput', () => {
  const files = new Map([['male/hat.glb', new Uint8Array([1])]])
  const content = { 'male/hat.glb': 'bafyglb', 'thumbnail.png': 'bafythumb' }

  it('hands the validator the entity metadata and the content list', () => {
    const [subject] = withPublishedIdentity(collection, [item('a', 1)])
    const input = buildStaticCheckInput(collection, subject, files, content)
    expect(input).toMatchObject({
      metadata: { id: `${collection.urn}:0`, collectionAddress: '0xcollection', data: { category: 'hat' } },
      content: [
        { file: 'male/hat.glb', hash: 'bafyglb' },
        { file: 'thumbnail.png', hash: 'bafythumb' }
      ]
    })
    expect((input as { files: Map<string, Uint8Array> }).files.get('male/hat.glb')).toEqual(new Uint8Array([1]))
  })

  it('falls back to a Builder manifest when the collection has no contract address yet', () => {
    const input = buildStaticCheckInput({ ...collection, contractAddress: undefined }, item('a', 1), files, content)
    const manifest = (input as { files: Map<string, Uint8Array> }).files.get('wearable.json')
    expect(JSON.parse(new TextDecoder().decode(manifest))).toMatchObject({ name: 'Item a', data: { category: 'hat' } })
    expect((input as { metadata?: unknown }).metadata).toBeUndefined()
  })
})

describe('runStaticChecks', () => {
  it('downloads every deployable file but the video, runs each item and splits errors from warnings', async () => {
    const fetchContent = vi.fn((hash: string, _signal?: AbortSignal) => Promise.resolve(new Blob([hash])))
    const validate = vi.fn().mockResolvedValue({
      passed: false,
      checks: [],
      captures: [],
      summary: { errors: 1, warnings: 1, checked: 2, skipped: 0 },
      findings: [
        { check: 'triangle-count', group: 'model', severity: 'error', rule: 'M-01', message: 'Too many', docs: 'd' },
        { check: 'texture-size', group: 'model', severity: 'warning', rule: 'M-04', message: 'Large', docs: 'd' }
      ]
    })
    const progress = vi.fn()
    const signal = new AbortController().signal
    const result = await runStaticChecks(collection, [item('a', 1), item('b', 2)], {
      fetchContent,
      loadValidator: () => Promise.resolve({ validate: validate as never, fixes: { 'triangle-count': 'Decimate' } }),
      onProgress: progress,
      signal
    })
    expect(fetchContent).toHaveBeenCalledTimes(6)
    expect(fetchContent).toHaveBeenCalledWith('bafyglb', signal)
    expect(fetchContent).not.toHaveBeenCalledWith('bafyvideo', expect.anything())
    expect(result.items.map(entry => entry.itemId)).toEqual(['a', 'b'])
    expect(result).toMatchObject({ errors: 2, warnings: 2 })
    expect(result.items[0].findings[0]).toMatchObject({ rule: 'M-01', severity: 'error' })
    expect(result.items[0].findings[0].fix).toBe('Decimate')
    expect(progress).toHaveBeenLastCalledWith({ done: 2, total: 2, itemId: 'b' })
  })

  it('stops reporting once the run was aborted', async () => {
    const controller = new AbortController()
    const validate = vi.fn().mockImplementation(() => {
      controller.abort()
      return Promise.resolve({ passed: true, checks: [], captures: [], summary: {}, findings: [] })
    })
    const progress = vi.fn()
    await expect(
      runStaticChecks(collection, [item('a', 1)], {
        fetchContent: () => Promise.resolve(new Blob()),
        loadValidator: () => Promise.resolve({ validate: validate as never, fixes: {} }),
        onProgress: progress,
        signal: controller.signal
      })
    ).rejects.toThrow()
    expect(progress).not.toHaveBeenCalled()
  })

  it('keeps the validator finding fields the UI shows', () => {
    expect(
      toStaticFinding({
        check: 'triangle-count',
        group: 'model',
        severity: 'error',
        rule: 'M-01',
        message: 'Too many',
        where: 'male/hat.glb',
        measured: 1940,
        limit: 1500,
        docs: 'https://docs'
      })
    ).toMatchObject({ rule: 'M-01', where: 'male/hat.glb', measured: 1940, limit: 1500, docs: 'https://docs' })
  })
})
