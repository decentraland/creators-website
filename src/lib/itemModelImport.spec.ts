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
  analyzeModel: (...args: unknown[]) => analyzeModel(...args)
}))

const { buildModelUpdate, getDefaultBodyShape, getModelUpdateMode, loadModelForItem, needsNewCategory } =
  await import('./itemModelImport')

const maleOnly: Item = {
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

const unisex: Item = {
  ...maleOnly,
  data: {
    category: 'hat',
    representations: [
      { bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb', 'male/tex.png'] },
      { bodyShapes: [BodyShape.FEMALE], mainFile: 'female/hat.glb', contents: ['female/hat.glb'] }
    ]
  },
  contents: {
    'male/hat.glb': 'bafyMale',
    'male/tex.png': 'bafyTex',
    'female/hat.glb': 'bafyFemale',
    'thumbnail.png': 'bafyThumb'
  }
}

const file = new File(['glb'], 'hat.glb')
const metrics = { triangles: 20 }
const newFile = () => ({
  contents: { 'new.glb': new Blob(['new']) },
  model: 'new.glb',
  type: ItemType.WEARABLE,
  fileBodyShape: null,
  isSmart: false,
  requiredPermissions: [],
  metrics: null,
  validationIssues: []
})
const bothZip = () => ({
  contents: { 'male/a.glb': new Blob(['a']), 'female/a.glb': new Blob(['b']) },
  model: 'male/a.glb',
  type: ItemType.WEARABLE,
  fileBodyShape: BodyShapeType.BOTH,
  isSmart: false,
  requiredPermissions: [],
  metrics: null,
  validationIssues: []
})

const shapesOf = (item: Item) => item.data.representations.map(representation => representation.bodyShapes[0])

beforeEach(() => {
  loadItemFile.mockReset().mockResolvedValue({
    contents: { 'hat.glb': new Blob(['new']), 'thumbnail.png': new Blob(['t']) },
    model: 'hat.glb',
    bodyShape: null
  })
  analyzeModel.mockReset().mockResolvedValue({ type: ItemType.WEARABLE, validationIssues: [], suggestedCategory: null })
})

describe('loadModelForItem', () => {
  it('refuses to change the model of a legacy social emote', async () => {
    const socialEmote = { ...maleOnly, type: ItemType.EMOTE, metrics: { additionalArmatures: 1 } }
    await expect(loadModelForItem(file, socialEmote)).rejects.toMatchObject({ messageKey: 'emote_social_unsupported' })
    expect(loadItemFile).not.toHaveBeenCalled()
  })

  it('rejects a file of the other item type', async () => {
    analyzeModel.mockResolvedValue({
      type: ItemType.EMOTE,
      validationIssues: [],
      suggestedCategory: null,
      emoteMetrics: {}
    })
    await expect(loadModelForItem(file, maleOnly)).rejects.toMatchObject({ messageKey: 'invalid_model_file_type' })
  })

  it('drops the thumbnail, validates against the item category and leaves 3D metrics to the preview', async () => {
    const issue = { code: 'x', severity: 'warning', message: 'm' }
    analyzeModel.mockResolvedValue({ type: ItemType.WEARABLE, validationIssues: [issue], suggestedCategory: null })
    const loaded = await loadModelForItem(file, { ...maleOnly, data: { ...maleOnly.data, hides: ['hair'] } })
    expect(Object.keys(loaded.contents)).toEqual(['hat.glb'])
    expect(analyzeModel).toHaveBeenCalledWith('hat.glb', loaded.contents, 'hat', ['hair'])
    expect(loaded).toMatchObject({ metrics: null, validationIssues: [issue], fileBodyShape: null, isSmart: false })
  })

  it('takes emote metrics from the analysis and keeps a texture wearable metrics', async () => {
    analyzeModel.mockResolvedValue({
      type: ItemType.EMOTE,
      validationIssues: [],
      suggestedCategory: null,
      emoteMetrics: { duration: 2 }
    })
    const emote = await loadModelForItem(file, { ...maleOnly, type: ItemType.EMOTE })
    expect(emote.metrics).toEqual({ duration: 2 })

    analyzeModel.mockResolvedValue({ type: ItemType.WEARABLE, validationIssues: [], suggestedCategory: null })
    loadItemFile.mockResolvedValue({ contents: { 'eyes.png': new Blob(['p']) }, model: 'eyes.png', bodyShape: null })
    const texture = await loadModelForItem(file, maleOnly)
    expect(texture.metrics).toEqual({ triangles: 10 })
  })
})

describe('getModelUpdateMode / getDefaultBodyShape', () => {
  it('maps the pick to what happens to the item', () => {
    expect(getModelUpdateMode(unisex, BodyShapeType.BOTH)).toBe('replace_all')
    expect(getModelUpdateMode(unisex, BodyShapeType.MALE)).toBe('replace_shape')
    expect(getModelUpdateMode(maleOnly, BodyShapeType.MALE)).toBe('replace_shape')
    expect(getModelUpdateMode(maleOnly, BodyShapeType.FEMALE)).toBe('add_representation')
    expect(getModelUpdateMode(maleOnly, BodyShapeType.BOTH)).toBe('replace_all')
  })

  it('starts from the shape the file fixes, else the shapes the item has, and both for unisex kinds', () => {
    expect(getDefaultBodyShape(unisex, newFile())).toBe(BodyShapeType.BOTH)
    expect(getDefaultBodyShape(maleOnly, newFile())).toBe(BodyShapeType.MALE)
    expect(getDefaultBodyShape(unisex, { ...newFile(), fileBodyShape: BodyShapeType.FEMALE })).toBe(
      BodyShapeType.FEMALE
    )
    expect(getDefaultBodyShape(maleOnly, bothZip())).toBe(BodyShapeType.MALE)
    expect(getDefaultBodyShape({ ...maleOnly, type: ItemType.EMOTE }, newFile())).toBe(BodyShapeType.BOTH)
    expect(getDefaultBodyShape(maleOnly, { ...newFile(), isSmart: true })).toBe(BodyShapeType.BOTH)
  })
})

describe('buildModelUpdate', () => {
  it('replaces every representation on "both", keeping thumbnail and catalyst image', async () => {
    const built = await buildModelUpdate(newFile(), maleOnly, BodyShapeType.BOTH, metrics)
    expect(shapesOf(built.item)).toEqual([BodyShape.MALE, BodyShape.FEMALE])
    expect(built.item.contents['thumbnail.png']).toBe('bafyThumb')
    expect(built.item.contents['image.png']).toBe('bafyImg')
    expect(built.item.contents['male/hat.glb']).toBeUndefined()
    expect(built.item.metrics).toEqual(metrics)
    expect(Object.keys(built.blobs).sort()).toEqual(['female/new.glb', 'male/new.glb'])
  })

  it('replaces only the picked shape of a two-model item and keeps the other', async () => {
    const built = await buildModelUpdate(newFile(), unisex, BodyShapeType.FEMALE, metrics)
    expect(built.item.data.representations[0]).toEqual(unisex.data.representations[0])
    expect(built.item.data.representations[1]).toMatchObject({
      bodyShapes: [BodyShape.FEMALE],
      mainFile: 'female/new.glb',
      contents: ['female/new.glb']
    })
    expect(built.item.contents).toMatchObject({
      'male/hat.glb': 'bafyMale',
      'male/tex.png': 'bafyTex',
      'thumbnail.png': 'bafyThumb'
    })
    expect(built.item.contents['female/hat.glb']).toBeUndefined()
    expect(Object.keys(built.blobs)).toEqual(['female/new.glb'])
  })

  it('keeps the shared file of a one-model unisex item under the other shape', async () => {
    const shared: Item = {
      ...unisex,
      data: {
        category: 'hat',
        representations: [
          {
            bodyShapes: [BodyShape.MALE],
            mainFile: 'male/hat.glb',
            contents: ['male/hat.glb'],
            overrideHides: ['hair']
          },
          { bodyShapes: [BodyShape.FEMALE], mainFile: 'female/hat.glb', contents: ['female/hat.glb'] }
        ]
      },
      contents: { 'male/hat.glb': 'bafySame', 'female/hat.glb': 'bafySame', 'thumbnail.png': 'bafyThumb' }
    }
    const built = await buildModelUpdate(newFile(), shared, BodyShapeType.MALE, metrics)
    expect(built.item.contents['female/hat.glb']).toBe('bafySame')
    expect(built.item.contents['male/hat.glb']).not.toBe('bafySame')
    expect(built.item.data.representations[0].overrideHides).toEqual(['hair'])
  })

  it('adds the missing shape as a new representation', async () => {
    const built = await buildModelUpdate(newFile(), maleOnly, BodyShapeType.FEMALE, metrics)
    expect(shapesOf(built.item)).toEqual([BodyShape.MALE, BodyShape.FEMALE])
    expect(built.item.contents['male/hat.glb']).toBe('bafyOld')
    expect(Object.keys(built.blobs)).toEqual(['female/new.glb'])
  })

  it('takes the picked folder of a zip with both body shapes, for adding and for replacing', async () => {
    const added = await buildModelUpdate(bothZip(), maleOnly, BodyShapeType.FEMALE, metrics)
    expect(added.item.data.representations[1]).toMatchObject({ mainFile: 'female/a.glb', contents: ['female/a.glb'] })
    expect(Object.keys(added.blobs)).toEqual(['female/a.glb'])

    const replaced = await buildModelUpdate(bothZip(), unisex, BodyShapeType.MALE, metrics)
    expect(replaced.item.data.representations[0]).toMatchObject({ mainFile: 'male/a.glb', contents: ['male/a.glb'] })
    expect(replaced.item.data.representations[1]).toEqual(unisex.data.representations[1])
    expect(Object.keys(replaced.blobs)).toEqual(['male/a.glb'])

    const all = await buildModelUpdate(bothZip(), maleOnly, BodyShapeType.BOTH, metrics)
    expect(shapesOf(all.item)).toEqual([BodyShape.MALE, BodyShape.FEMALE])
    expect(Object.keys(all.blobs).sort()).toEqual(['female/a.glb', 'male/a.glb'])
  })

  it('refuses a representation whose file kind does not match the one kept', async () => {
    const texture = { ...newFile(), contents: { 'eyes.png': new Blob(['png']) }, model: 'eyes.png' }
    const upperBody = { ...maleOnly, data: { ...maleOnly.data, category: 'upper_body' } }
    await expect(buildModelUpdate(texture, upperBody, BodyShapeType.FEMALE, metrics)).rejects.toMatchObject({
      messageKey: 'representation_category_mismatch'
    })
    await expect(buildModelUpdate(texture, unisex, BodyShapeType.FEMALE, metrics)).rejects.toMatchObject({
      messageKey: 'representation_category_mismatch'
    })
    // Replacing the only representation may switch kinds: the editor then asks for a category.
    const switched = await buildModelUpdate(texture, maleOnly, BodyShapeType.MALE, metrics)
    expect(switched.item.data.representations[0].mainFile).toBe('male/eyes.png')
    expect(needsNewCategory(texture, maleOnly, BodyShapeType.MALE)).toBe(true)
    expect(needsNewCategory(texture, maleOnly, BodyShapeType.FEMALE)).toBe(false)
    expect(needsNewCategory(newFile(), maleOnly, BodyShapeType.MALE)).toBe(false)
  })
})
