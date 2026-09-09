import { describe, expect, it } from 'vitest'
import { ethers } from 'ethers'
import {
  EmotePlayMode,
  addRepresentationToItem,
  buildItem,
  buildRepresentations,
  computeHashes,
  getSizeError,
  sortContent,
  sortContentZipBothBodyShape,
  withThumbnail,
  type ItemDraftPayload
} from './itemFactory'
import { BODY_SHAPE_FEMALE, BODY_SHAPE_MALE, BodyShapeType, ItemType, type Item } from './items'

const blob = (text = 'x') => new Blob([text])

const baseDraft: ItemDraftPayload = {
  id: 'draft-1',
  name: 'Cool Hat',
  type: ItemType.WEARABLE,
  bodyShape: BodyShapeType.BOTH,
  category: 'hat',
  rarity: 'epic',
  contents: { 'model.glb': blob('model'), 'thumbnail.png': blob('thumb') },
  model: 'model.glb',
  metrics: { triangles: 100 },
  owner: '0xowner',
  collectionId: 'col-1'
}

describe('sortContent', () => {
  it('prefixes contents per body shape and keeps the thumbnail at the root', () => {
    const sorted = sortContent(BodyShapeType.BOTH, baseDraft.contents)
    expect(Object.keys(sorted.male)).toEqual(['male/model.glb'])
    expect(Object.keys(sorted.female)).toEqual(['female/model.glb'])
    expect(Object.keys(sorted.all).sort()).toEqual(['female/model.glb', 'male/model.glb', 'thumbnail.png'])
  })

  it('leaves the other shape empty for a single-shape item', () => {
    const sorted = sortContent(BodyShapeType.MALE, baseDraft.contents)
    expect(Object.keys(sorted.female)).toEqual([])
  })

  it('omits the thumbnail from `all` when the draft has none yet', () => {
    const sorted = sortContent(BodyShapeType.BOTH, { 'model.glb': blob('model') })
    expect(Object.keys(sorted.all).sort()).toEqual(['female/model.glb', 'male/model.glb'])
  })
})

describe('sortContentZipBothBodyShape', () => {
  it('routes pre-prefixed files to their shape and duplicates shared files', () => {
    const contents = {
      'male/model.glb': blob('m'),
      'female/model.glb': blob('f'),
      'sound.mp3': blob('s'),
      'thumbnail.png': blob('t')
    }
    const sorted = sortContentZipBothBodyShape(BodyShapeType.BOTH, contents)
    expect(Object.keys(sorted.male).sort()).toEqual(['male/model.glb', 'male/sound.mp3'])
    expect(Object.keys(sorted.female).sort()).toEqual(['female/model.glb', 'female/sound.mp3'])
  })
})

describe('buildRepresentations', () => {
  it('creates one representation per selected body shape', () => {
    const sorted = sortContent(BodyShapeType.BOTH, baseDraft.contents)
    const representations = buildRepresentations(BodyShapeType.BOTH, 'model.glb', sorted)
    expect(representations).toHaveLength(2)
    expect(representations[0].bodyShapes).toEqual([BODY_SHAPE_MALE])
    expect(representations[0].mainFile).toBe('male/model.glb')
    expect(representations[1].bodyShapes).toEqual([BODY_SHAPE_FEMALE])
  })
})

describe('computeHashes', () => {
  it('produces a CIDv1 per path', async () => {
    const hashes = await computeHashes({ 'a.glb': blob('same'), 'b.glb': blob('same') })
    expect(hashes['a.glb']).toMatch(/^baf/)
    expect(hashes['a.glb']).toBe(hashes['b.glb'])
  })
})

describe('getSizeError', () => {
  const bigBlob = new Blob([new Uint8Array(4 * 1024 * 1024)])

  it('caps wearables at 3MB, skins at 8MB and emotes at 3MB', () => {
    expect(getSizeError(ItemType.WEARABLE, 'hat', { 'model.glb': bigBlob })).toBe(3)
    expect(getSizeError(ItemType.WEARABLE, 'skin', { 'model.glb': bigBlob })).toBeNull()
    expect(getSizeError(ItemType.EMOTE, undefined, { 'model.glb': bigBlob })).toBe(3)
    expect(getSizeError(ItemType.WEARABLE, 'hat', { 'model.glb': blob() })).toBeNull()
  })
})

describe('buildItem', () => {
  it('builds a not-for-sale wearable with hashed, shape-prefixed contents', async () => {
    const { item, blobs } = await buildItem(baseDraft)
    expect(item.id).toBe('draft-1')
    expect(item.rarity).toBe('epic')
    expect(item.collectionId).toBe('col-1')
    expect(item.price).toBe(ethers.constants.MaxUint256.toString())
    expect(item.beneficiary).toBe('0xowner')
    expect(item.data.representations).toHaveLength(2)
    expect(item.data.category).toBe('hat')
    expect(Object.keys(item.contents).sort()).toEqual(['female/model.glb', 'male/model.glb', 'thumbnail.png'])
    expect(Object.keys(blobs).sort()).toEqual(['female/model.glb', 'male/model.glb', 'thumbnail.png'])
  })

  it('marks upper_body wearables as removing the default hands hiding', async () => {
    const { item } = await buildItem({ ...baseDraft, category: 'upper_body' })
    expect(item.data.removesDefaultHiding).toEqual(['hands'])
  })

  it('builds emotes with loop derived from the play mode', async () => {
    const { item } = await buildItem({
      ...baseDraft,
      type: ItemType.EMOTE,
      category: 'dance',
      playMode: EmotePlayMode.LOOP
    })
    expect(item.data.loop).toBe(true)
    expect(item.data.representations).toHaveLength(2)
  })

  it('handles zips that already carry both body-shape folders', async () => {
    const { item } = await buildItem({
      ...baseDraft,
      contents: {
        'male/model.glb': blob('m'),
        'female/model.glb': blob('f'),
        'thumbnail.png': blob('t')
      }
    })
    expect(item.data.representations.map(representation => representation.mainFile)).toEqual([
      'male/model.glb',
      'female/model.glb'
    ])
  })
})

describe('addRepresentationToItem', () => {
  async function buildBase(): Promise<Item> {
    const { item } = await buildItem({ ...baseDraft, bodyShape: BodyShapeType.MALE })
    return item
  }

  it('appends the missing shape and keeps the existing thumbnail', async () => {
    const base = await buildBase()
    const variant: ItemDraftPayload = {
      ...baseDraft,
      id: 'draft-2',
      bodyShape: BodyShapeType.FEMALE,
      contents: { 'female-model.glb': blob('female'), 'thumbnail.png': blob('other-thumb') },
      model: 'female-model.glb'
    }
    const { item, blobs } = await addRepresentationToItem({ item: base }, variant)
    expect(item.data.representations).toHaveLength(2)
    expect(item.data.representations[1].bodyShapes).toEqual([BODY_SHAPE_FEMALE])
    expect(item.data.representations[1].mainFile).toBe('female/female-model.glb')
    // Only the new shape's files upload; the target's thumbnail is untouched.
    expect(Object.keys(blobs)).toEqual(['female/female-model.glb'])
    expect(item.contents['thumbnail.png']).toBe(base.contents['thumbnail.png'])
  })

  it('rejects a variant for a shape the target already has', async () => {
    const base = await buildBase()
    const variant = { ...baseDraft, id: 'draft-2', bodyShape: BodyShapeType.MALE }
    await expect(addRepresentationToItem({ item: base }, variant)).rejects.toThrow()
  })
})

describe('withThumbnail', () => {
  const saved: Item = {
    id: 'item-1',
    name: 'Hat',
    description: '',
    thumbnail: 'old-thumb.png',
    owner: '0xowner',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: { category: 'hat', representations: [] },
    contents: { 'male/model.glb': 'bafmodel', 'old-thumb.png': 'bafold' },
    createdAt: 1,
    updatedAt: 1
  }

  it('points the item at the new hashed thumbnail and returns the file to upload', async () => {
    const thumbnail = blob('new png')
    const built = await withThumbnail(saved, thumbnail)
    expect(built.item.thumbnail).toBe('thumbnail.png')
    expect(built.item.contents['thumbnail.png']).toMatch(/^baf/)
    expect(built.item.contents['male/model.glb']).toBe('bafmodel')
    expect(built.item.contents).not.toHaveProperty('old-thumb.png')
    expect(built.blobs).toEqual({ 'thumbnail.png': thumbnail })
  })
})
