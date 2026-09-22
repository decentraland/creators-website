import { describe, expect, it } from 'vitest'
import { ethers } from 'ethers'
import {
  EmotePlayMode,
  addRepresentationToItem,
  assertUploadSize,
  buildItem,
  buildRepresentations,
  computeHashes,
  getSizeError,
  isValidItemName,
  sortContent,
  sortContentZipBothBodyShape,
  withRehashedContents,
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

  it('caps smart wearables at 3MB without counting the preview video', () => {
    expect(getSizeError(ItemType.WEARABLE, 'hat', { 'model.glb': bigBlob, 'bin/game.js': blob() })).toBe(3)
    expect(getSizeError(ItemType.WEARABLE, 'hat', { 'model.glb': blob(), 'video.mp4': bigBlob })).toBeNull()
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
    expect(Object.keys(item.contents).sort()).toEqual([
      'female/model.glb',
      'image.png',
      'male/model.glb',
      'thumbnail.png'
    ])
    expect(Object.keys(blobs).sort()).toEqual(['female/model.glb', 'image.png', 'male/model.glb', 'thumbnail.png'])
  })

  it('carries the manifest description, tags and VRM flag into the item', async () => {
    const { item } = await buildItem({
      ...baseDraft,
      description: 'A hat',
      tags: ['hat', 'cool'],
      blockVrmExport: true
    })
    expect(item.description).toBe('A hat')
    expect(item.data.tags).toEqual(['hat', 'cool'])
    expect(item.data.blockVrmExport).toBe(true)
  })

  it('marks upper_body wearables as removing the default hands hiding', async () => {
    const { item } = await buildItem({ ...baseDraft, category: 'upper_body' })
    expect(item.data.removesDefaultHiding).toEqual(['hands'])
  })

  it('writes prefilled hides into the data and every representation, with the hands rule', async () => {
    const { item } = await buildItem({ ...baseDraft, hides: ['upper_body', 'hair'] })
    expect(item.data.hides).toEqual(['upper_body', 'hair'])
    expect(item.data.removesDefaultHiding).toEqual(['hands'])
    expect(item.data.representations.map(representation => representation.overrideHides)).toEqual([
      ['upper_body', 'hair'],
      ['upper_body', 'hair']
    ])
  })

  it('keys prefilled spring bone params by the hashed model of each representation', async () => {
    const params = {
      springbone_tail: {
        stiffness: 1,
        gravityPower: 0,
        gravityDir: [0, -1, 0] as [number, number, number],
        drag: 0.5,
        isRoot: true
      }
    }
    const { item } = await buildItem({ ...baseDraft, springBoneParams: params })
    const hash = item.contents['male/model.glb']
    expect(item.data.springBones).toEqual({ version: 1, models: { [hash]: params } })
    expect((await buildItem(baseDraft)).item.data.springBones).toBeUndefined()
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

  it('ships scene code per body shape and keeps the video at the root of a smart wearable', async () => {
    const { item, blobs } = await buildItem({
      ...baseDraft,
      requiredPermissions: ['USE_FETCH'],
      contents: {
        ...baseDraft.contents,
        'scene.json': blob('{}'),
        'bin/game.js': blob('code'),
        'video.mp4': blob('video')
      }
    })
    expect(Object.keys(item.contents).sort()).toEqual([
      'female/bin/game.js',
      'female/model.glb',
      'female/scene.json',
      'image.png',
      'male/bin/game.js',
      'male/model.glb',
      'male/scene.json',
      'thumbnail.png',
      'video.mp4'
    ])
    expect(item.data.representations[0].contents).toContain('male/bin/game.js')
    expect(item.data.requiredPermissions).toEqual(['USE_FETCH'])
    expect(item.video).toBe(item.contents['video.mp4'])
    expect(Object.keys(blobs)).toContain('video.mp4')
  })

  it('sends an empty permission list for plain wearables and none for emotes', async () => {
    const wearable = await buildItem(baseDraft)
    expect(wearable.item.data.requiredPermissions).toEqual([])
    expect(wearable.item.video).toBeUndefined()
    const emote = await buildItem({ ...baseDraft, type: ItemType.EMOTE, category: 'dance' })
    expect(emote.item.data.requiredPermissions).toBeUndefined()
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
    expect(Object.keys(built.blobs).sort()).toEqual(['image.png', 'thumbnail.png'])
    expect(built.blobs['thumbnail.png']).toBe(thumbnail)
  })
})

describe('isValidItemName', () => {
  it('requires a non-empty name up to 32 chars without ":"', () => {
    expect(isValidItemName('Cool Hat')).toBe(true)
    expect(isValidItemName('  ')).toBe(false)
    expect(isValidItemName('a'.repeat(33))).toBe(false)
    expect(isValidItemName('a:b')).toBe(false)
  })
})

describe('withRehashedContents', () => {
  const legacy: Item = {
    id: 'item-1',
    name: 'Hat',
    description: '',
    thumbnail: 'thumbnail.png',
    owner: '0xowner',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: { category: 'hat', representations: [] },
    contents: { 'male/model.glb': 'QmOldModel', 'thumbnail.png': 'bafthumb' },
    createdAt: 1,
    updatedAt: 1
  }

  it('re-hashes only the legacy-hashed files and returns them for upload', async () => {
    const download = async (hash: string) => blob(`file ${hash}`)
    const built = await withRehashedContents(legacy, download)
    expect(built.item.contents['male/model.glb']).toMatch(/^baf/)
    expect(built.item.contents['thumbnail.png']).toBe('bafthumb')
    expect(Object.keys(built.blobs)).toEqual(['male/model.glb'])
  })
})

describe('assertUploadSize', () => {
  it('counts a blob shared by both body shapes once', async () => {
    const model = new Blob([new Uint8Array(2 * 1024 * 1024)])
    const { item, blobs } = await buildItem({
      ...baseDraft,
      contents: { 'model.glb': model, 'thumbnail.png': blob('t') }
    })
    expect(Object.keys(blobs).filter(path => path.endsWith('model.glb'))).toHaveLength(2)
    expect(() => assertUploadSize(item, blobs)).not.toThrow()
  })

  it('re-checks the thumbnail cap and the item cap including files already stored', async () => {
    const { item, blobs } = await buildItem(baseDraft)
    expect(() => assertUploadSize(item, blobs)).not.toThrow()
    expect(() =>
      assertUploadSize(item, { ...blobs, 'thumbnail.png': new Blob([new Uint8Array(1024 * 1024 + 1)]) })
    ).toThrow(/thumbnail_too_big/)
    expect(() => assertUploadSize(item, blobs, [3 * 1024 * 1024])).toThrow(/size_exceeded/)
  })
})
