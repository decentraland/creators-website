import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BodyShape } from '@dcl/schemas'
import { BodyShapeType, ItemType, type Item } from './items'

const loadItemFile = vi.fn()
const analyzeModel = vi.fn()
vi.mock('./itemFiles', async importOriginal => ({
  ...(await importOriginal<typeof import('./itemFiles')>()),
  loadItemFile: (...args: unknown[]) => loadItemFile(...args)
}))
vi.mock('./models', () => ({
  analyzeModel: (...args: unknown[]) => analyzeModel(...args),
  loadGltf: vi.fn(),
  getModelMetrics: vi.fn()
}))

const { importItemModel } = await import('./itemModelImport')

const item: Item = {
  id: 'w1',
  name: 'Hat',
  description: '',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  collectionId: 'c1',
  rarity: 'epic',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: {
    category: 'hat',
    representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] }]
  },
  contents: { 'male/hat.glb': 'bafyOld', 'thumbnail.png': 'bafyThumb', 'image.png': 'bafyImg' },
  metrics: { triangles: 10 },
  createdAt: 1,
  updatedAt: 1
}

const file = new File(['glb'], 'hat.glb')

beforeEach(() => {
  // jsdom's createObjectURL only accepts its own Blob class; the metrics loader is mocked anyway.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:model')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  loadItemFile.mockReset().mockResolvedValue({
    contents: { 'hat.glb': new Blob(['new']), 'thumbnail.png': new Blob(['t']) },
    model: 'hat.glb',
    bodyShape: null
  })
  analyzeModel.mockReset().mockResolvedValue({ type: ItemType.WEARABLE, validationIssues: [], suggestedCategory: null })
})

describe('importItemModel', () => {
  it('rejects a file of the other item type', async () => {
    analyzeModel.mockResolvedValue({
      type: ItemType.EMOTE,
      validationIssues: [],
      suggestedCategory: null,
      emoteMetrics: {}
    })
    await expect(importItemModel(file, item, { kind: 'replace' })).rejects.toMatchObject({
      messageKey: 'invalid_model_file_type'
    })
  })

  it('replaces the model for the item body shapes, keeping thumbnail and catalyst image', async () => {
    const built = await importItemModel(
      new File(['png'], 'hat.png'),
      { ...item, contents: { ...item.contents } },
      { kind: 'replace' }
    )
    expect(built.item.data.representations).toEqual([
      {
        bodyShapes: [BodyShape.MALE],
        mainFile: 'male/hat.glb',
        contents: ['male/hat.glb'],
        overrideHides: [],
        overrideReplaces: []
      }
    ])
    expect(built.item.contents['thumbnail.png']).toBe('bafyThumb')
    expect(built.item.contents['image.png']).toBe('bafyImg')
    expect(built.item.contents['male/hat.glb']).not.toBe('bafyOld')
    expect(Object.keys(built.blobs)).toEqual(['male/hat.glb'])
  })

  it('adds the missing representation and refuses a two-shape zip for it', async () => {
    const built = await importItemModel(new File(['png'], 'hat.png'), item, {
      kind: 'add-representation',
      bodyShape: BodyShapeType.FEMALE
    })
    expect(built.item.data.representations.map(representation => representation.bodyShapes[0])).toEqual([
      BodyShape.MALE,
      BodyShape.FEMALE
    ])
    expect(Object.keys(built.blobs)).toEqual(['female/hat.glb'])

    loadItemFile.mockResolvedValue({
      contents: { 'male/a.glb': new Blob(['a']), 'female/a.glb': new Blob(['b']) },
      model: 'male/a.glb',
      bodyShape: BodyShapeType.BOTH
    })
    await expect(
      importItemModel(file, item, { kind: 'add-representation', bodyShape: BodyShapeType.FEMALE })
    ).rejects.toMatchObject({ messageKey: 'invalid_representation' })
  })
})
