import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BodyShapeType, ItemType } from './items'
import { EmotePlayMode, buildItem, type ItemDraftPayload } from './itemFactory'
import { BuilderServerError } from './builder'
import { executeUpload, planUpload, type UploadDraft } from './uploadItems'

vi.mock('./builder', async importOriginal => {
  const original = await importOriginal<typeof import('./builder')>()
  return { ...original, saveItem: vi.fn(), fetchContent: vi.fn() }
})

const { saveItem, fetchContent } = await import('./builder')
const saveItemMock = vi.mocked(saveItem)
const fetchContentMock = vi.mocked(fetchContent)

const blob = (text = 'x') => new Blob([text])

function draft(id: string, overrides: Partial<UploadDraft> = {}): UploadDraft {
  return {
    id,
    name: `Item ${id}`,
    type: ItemType.WEARABLE,
    bodyShape: BodyShapeType.BOTH,
    category: 'hat',
    rarity: 'epic',
    playMode: EmotePlayMode.SIMPLE,
    contents: { 'model.glb': blob(id), 'thumbnail.png': blob('thumb') },
    model: 'model.glb',
    metrics: { triangles: 10 },
    owner: '0xowner',
    collectionId: 'col-1',
    ...overrides
  }
}

beforeEach(() => {
  saveItemMock.mockReset()
  saveItemMock.mockResolvedValue({} as never)
  fetchContentMock.mockReset()
  fetchContentMock.mockResolvedValue(blob('stored'))
})

describe('planUpload', () => {
  it('creates one operation per base draft', async () => {
    const operations = await planUpload([draft('a'), draft('b')], [])
    expect(operations).toHaveLength(2)
    expect(operations.map(operation => operation.draftIds)).toEqual([['a'], ['b']])
  })

  it('merges a variant of a batch draft into its base operation', async () => {
    const base = draft('base', { bodyShape: BodyShapeType.MALE })
    const variant = draft('variant', {
      bodyShape: BodyShapeType.FEMALE,
      variantTargetId: 'base',
      contents: { 'f.glb': blob('f'), 'thumbnail.png': blob('t') },
      model: 'f.glb'
    })
    const operations = await planUpload([base, variant], [])
    expect(operations).toHaveLength(1)
    expect(operations[0].draftIds).toEqual(['base', 'variant'])
    expect(operations[0].built.item.data.representations).toHaveLength(2)
  })

  it('appends a variant of an existing item without re-uploading its thumbnail', async () => {
    const { item: existing } = await buildItem({
      ...(draft('existing') as ItemDraftPayload),
      bodyShape: BodyShapeType.MALE
    })
    const variant = draft('variant', {
      bodyShape: BodyShapeType.FEMALE,
      variantTargetId: existing.id,
      contents: { 'f.glb': blob('f'), 'thumbnail.png': blob('t') },
      model: 'f.glb'
    })
    const operations = await planUpload([variant], [existing])
    expect(operations).toHaveLength(1)
    expect(operations[0].isExistingItemUpdate).toBe(true)
    expect(Object.keys(operations[0].built.blobs)).toEqual(['female/f.glb'])
  })

  it('rejects a variant whose target is nowhere to be found', async () => {
    await expect(
      planUpload([draft('v', { variantTargetId: 'ghost', bodyShape: BodyShapeType.MALE })], [])
    ).rejects.toThrow()
  })
})

describe('executeUpload', () => {
  it('reports every draft as saved on success', async () => {
    const operations = await planUpload([draft('a'), draft('b')], [])
    const result = await executeUpload('0xowner', operations)
    expect(result).toEqual({ savedDraftIds: ['a', 'b'], failedDraftIds: [], failureReason: null })
    expect(saveItemMock).toHaveBeenCalledTimes(2)
  })

  it('keeps uploading after a generic failure and reports partial results', async () => {
    saveItemMock.mockRejectedValueOnce(new BuilderServerError('boom', 500))
    const operations = await planUpload([draft('a'), draft('b')], [])
    const result = await executeUpload('0xowner', operations)
    expect(result.savedDraftIds).toEqual(['b'])
    expect(result.failedDraftIds).toEqual(['a'])
    expect(result.failureReason).toBe('generic')
  })

  it('aborts on a locked collection and fails everything left', async () => {
    saveItemMock.mockRejectedValueOnce(new BuilderServerError('locked', 423))
    const operations = await planUpload([draft('a'), draft('b'), draft('c')], [])
    const result = await executeUpload('0xowner', operations)
    expect(result.savedDraftIds).toEqual([])
    expect(result.failedDraftIds).toEqual(['a', 'b', 'c'])
    expect(result.failureReason).toBe('locked')
    expect(saveItemMock).toHaveBeenCalledTimes(1)
  })

  it('refuses a representation that would push the stored item over its cap, and keeps uploading', async () => {
    const { item: existing } = await buildItem({
      ...(draft('existing') as ItemDraftPayload),
      bodyShape: BodyShapeType.MALE
    })
    const variant = draft('variant', {
      bodyShape: BodyShapeType.FEMALE,
      variantTargetId: existing.id,
      contents: { 'f.glb': blob('f'), 'thumbnail.png': blob('t') },
      model: 'f.glb'
    })
    // Stored model + retained thumbnail together cross the cap; neither alone does.
    fetchContentMock.mockImplementation(async (hash: string) =>
      hash === existing.contents['thumbnail.png']
        ? new Blob([new Uint8Array(1024 * 1024)])
        : new Blob([new Uint8Array(2.5 * 1024 * 1024)])
    )
    const operations = await planUpload([variant, draft('b')], [existing])
    const result = await executeUpload('0xowner', operations)
    expect(result.failedDraftIds).toEqual(['variant'])
    expect(result.savedDraftIds).toEqual(['b'])
    expect(result.failureReason).toBe('too_big')
    expect(saveItemMock).toHaveBeenCalledTimes(1)
  })

  it('counts a stored file referenced at several paths once', async () => {
    const { item: built } = await buildItem({
      ...(draft('existing') as ItemDraftPayload),
      bodyShape: BodyShapeType.MALE
    })
    const modelHash = built.contents['male/model.glb']
    const existing = { ...built, contents: { ...built.contents, 'male/copy.glb': modelHash } }
    const variant = draft('variant', {
      bodyShape: BodyShapeType.FEMALE,
      variantTargetId: existing.id,
      contents: { 'f.glb': blob('f'), 'thumbnail.png': blob('t') },
      model: 'f.glb'
    })
    // 2MB once fits; counted per path it would not.
    fetchContentMock.mockImplementation(async (hash: string) =>
      hash === modelHash ? new Blob([new Uint8Array(2 * 1024 * 1024)]) : blob('small')
    )
    const result = await executeUpload('0xowner', await planUpload([variant], [existing]))
    expect(result.savedDraftIds).toEqual(['variant'])
    expect(fetchContentMock).toHaveBeenCalledTimes(2)
  })

  it('maps an already-published conflict to its own reason', async () => {
    saveItemMock.mockRejectedValue(new BuilderServerError('published', 409))
    const operations = await planUpload([draft('a')], [])
    const result = await executeUpload('0xowner', operations)
    expect(result.failureReason).toBe('published')
  })
})
