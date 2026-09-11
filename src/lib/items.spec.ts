import { describe, it, expect } from 'vitest'
import { CollectionDisplayStatus } from './collections'
import {
  BODY_SHAPE_FEMALE,
  BODY_SHAPE_MALE,
  BodyShapeType,
  canManageItem,
  isMissingSmartWearableVideo,
  isSmartWearable,
  fromRemoteItem,
  getItemBodyShapeType,
  getItemDisplayStatus,
  getItemMetadata,
  getItemSales,
  getMissingBodyShapeType,
  ItemType,
  toRemoteItem,
  type Item,
  type RemoteItem
} from './items'

const MALE = 'urn:decentraland:off-chain:base-avatars:BaseMale'
const FEMALE = 'urn:decentraland:off-chain:base-avatars:BaseFemale'

const remote: RemoteItem = {
  id: 'i1',
  name: 'Pirate Hat',
  description: 'Yarr',
  thumbnail: 'thumbnail.png',
  eth_address: '0xabc',
  collection_id: 'c1',
  price: '1000',
  beneficiary: '0xbenef',
  rarity: 'legendary',
  is_published: true,
  is_approved: true,
  in_catalyst: true,
  type: ItemType.WEARABLE,
  data: {
    category: 'hat',
    representations: [{ bodyShapes: [MALE, FEMALE], mainFile: 'hat.glb', contents: ['hat.glb'] }]
  },
  contents: { 'thumbnail.png': 'Qmhash', 'hat.glb': 'Qmglb' },
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-04-02T10:00:00Z'
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return { ...fromRemoteItem(remote), ...overrides }
}

describe('fromRemoteItem', () => {
  it('maps the wire shape to the domain model with epoch dates', () => {
    const item = fromRemoteItem(remote)
    expect(item).toMatchObject({
      id: 'i1',
      name: 'Pirate Hat',
      owner: '0xabc',
      collectionId: 'c1',
      rarity: 'legendary',
      isPublished: true,
      isApproved: true,
      type: ItemType.WEARABLE
    })
    expect(item.createdAt).toBe(+new Date('2026-03-01T10:00:00Z'))
    expect(item.updatedAt).toBe(+new Date('2026-04-02T10:00:00Z'))
  })

  it('omits empty optionals', () => {
    const item = fromRemoteItem({ ...remote, collection_id: null, price: null, beneficiary: null, rarity: null })
    expect(item.collectionId).toBeUndefined()
    expect(item.price).toBeUndefined()
    expect(item.beneficiary).toBeUndefined()
    expect(item.rarity).toBeUndefined()
  })
})

describe('getItemBodyShapeType', () => {
  it('detects unisex, male-only, female-only and no representations', () => {
    expect(getItemBodyShapeType(makeItem())).toBe(BodyShapeType.BOTH)
    expect(
      getItemBodyShapeType(
        makeItem({ data: { representations: [{ bodyShapes: [MALE], mainFile: 'a', contents: [] }] } })
      )
    ).toBe(BodyShapeType.MALE)
    expect(
      getItemBodyShapeType(
        makeItem({ data: { representations: [{ bodyShapes: [FEMALE], mainFile: 'a', contents: [] }] } })
      )
    ).toBe(BodyShapeType.FEMALE)
    expect(getItemBodyShapeType(makeItem({ data: { representations: [] } }))).toBeNull()
  })
})

describe('getItemDisplayStatus', () => {
  it('derives published / under review / draft', () => {
    expect(getItemDisplayStatus(makeItem())).toBe(CollectionDisplayStatus.PUBLISHED)
    expect(getItemDisplayStatus(makeItem({ isApproved: false }))).toBe(CollectionDisplayStatus.UNDER_REVIEW)
    expect(getItemDisplayStatus(makeItem({ isPublished: false, isApproved: false }))).toBe(
      CollectionDisplayStatus.DRAFT
    )
  })
})

describe('getItemMetadata', () => {
  it('builds the legacy wearable metadata string', () => {
    expect(getItemMetadata(makeItem())).toBe('1:w:Pirate Hat:Yarr:hat:BaseMale,BaseFemale')
  })

  it('marks smart wearables by their .js contents', () => {
    const item = makeItem({ contents: { ...remote.contents, 'game.js': 'Qmjs' } })
    expect(getItemMetadata(item)).toBe('1:sw:Pirate Hat:Yarr:hat:BaseMale,BaseFemale')
  })

  it('appends loop, sound/props and outcome flags for emotes', () => {
    const emote = makeItem({
      type: ItemType.EMOTE,
      contents: { 'emote.glb': 'Qm', 'sound.mp3': 'Qms' },
      metrics: { props: 2 },
      data: {
        category: 'dance',
        loop: true,
        outcomes: [{}, {}],
        randomizeOutcomes: true,
        representations: [{ bodyShapes: [MALE, FEMALE], mainFile: 'emote.glb', contents: ['emote.glb'] }]
      }
    })
    expect(getItemMetadata(emote)).toBe('1:e:Pirate Hat:Yarr:dance:BaseMale,BaseFemale:1:sg:ro')
  })

  it('leaves plain emotes with just the loop flag', () => {
    const emote = makeItem({
      type: ItemType.EMOTE,
      contents: { 'emote.glb': 'Qm' },
      data: {
        category: 'dance',
        representations: [{ bodyShapes: [MALE], mainFile: 'emote.glb', contents: ['emote.glb'] }]
      }
    })
    expect(getItemMetadata(emote)).toBe('1:e:Pirate Hat:Yarr:dance:BaseMale:0')
  })

  it('throws when the item has no category', () => {
    expect(() => getItemMetadata(makeItem({ data: { representations: [] } }))).toThrow(/category/)
  })
})

describe('toRemoteItem', () => {
  it('maps the write-direction wire shape the legacy builder sends', () => {
    const item: Item = {
      id: 'item-1',
      name: 'Hat',
      description: '',
      thumbnail: 'thumbnail.png',
      owner: '0xowner',
      collectionId: 'col-1',
      rarity: 'epic',
      totalSupply: 0,
      price: '10',
      beneficiary: '0xowner',
      isPublished: true,
      isApproved: true,
      inCatalyst: false,
      type: ItemType.WEARABLE,
      data: { representations: [] },
      metrics: { triangles: 10 },
      contents: { 'male/model.glb': 'Qm1' },
      createdAt: 1,
      updatedAt: 1
    }

    const remote = toRemoteItem(item)

    expect(remote.eth_address).toBe('0xowner')
    expect(remote.collection_id).toBe('col-1')
    expect(remote.total_supply).toBe(0)
    expect(remote.urn).toBeNull()
    expect(remote.video).toBeNull()
    // The server owns publication state; the client always sends false.
    expect(remote.is_published).toBe(false)
    expect(remote.is_approved).toBe(false)
    expect(remote.contents).toEqual({ 'male/model.glb': 'Qm1' })
  })
})

describe('getMissingBodyShapeType', () => {
  const representation = (bodyShapes: string[]) => ({ bodyShapes, mainFile: 'f', contents: ['f'] })

  function itemWithShapes(bodyShapes: string[]): Item {
    return {
      id: 'i',
      name: 'n',
      description: '',
      thumbnail: 't',
      owner: '0x',
      isPublished: false,
      isApproved: false,
      inCatalyst: false,
      type: ItemType.WEARABLE,
      data: { representations: [representation(bodyShapes)] },
      contents: {},
      createdAt: 1,
      updatedAt: 1
    }
  }

  it('returns the opposite single shape, or null for unisex items', () => {
    expect(getMissingBodyShapeType(itemWithShapes([BODY_SHAPE_MALE]))).toBe(BodyShapeType.FEMALE)
    expect(getMissingBodyShapeType(itemWithShapes([BODY_SHAPE_FEMALE]))).toBe(BodyShapeType.MALE)
    expect(getMissingBodyShapeType(itemWithShapes([BODY_SHAPE_MALE, BODY_SHAPE_FEMALE]))).toBeNull()
  })
})

describe('getItemSales', () => {
  const base = fromRemoteItem(remote)

  it('pairs the minted count with the rarity max supply', () => {
    expect(getItemSales({ ...base, rarity: 'legendary', totalSupply: 15 })).toEqual({ minted: 15, maxSupply: 100 })
    expect(getItemSales({ ...base, rarity: 'legendary', totalSupply: undefined })).toEqual({
      minted: 0,
      maxSupply: 100
    })
  })

  it('has no sales without a rarity', () => {
    expect(getItemSales({ ...base, rarity: undefined })).toBeUndefined()
  })
})

describe('isSmartWearable', () => {
  it('is a wearable that ships scene code, never an emote', () => {
    expect(isSmartWearable(makeItem())).toBe(false)
    expect(isSmartWearable(makeItem({ contents: { ...remote.contents, 'game.js': 'Qmjs' } }))).toBe(true)
    expect(isSmartWearable(makeItem({ type: ItemType.EMOTE, contents: { 'game.js': 'Qmjs' } }))).toBe(false)
  })
})

describe('isMissingSmartWearableVideo', () => {
  it('only flags smart wearables whose video.mp4 is not in the contents yet', () => {
    const smart = { ...remote.contents, 'male/bin/game.js': 'Qmjs' }
    expect(isMissingSmartWearableVideo(makeItem())).toBe(false)
    expect(isMissingSmartWearableVideo(makeItem({ contents: smart }))).toBe(true)
    expect(isMissingSmartWearableVideo(makeItem({ contents: { ...smart, 'video.mp4': 'Qmvideo' } }))).toBe(false)
  })
})

describe('canManageItem', () => {
  const collection = {
    id: 'c1',
    name: 'Hats',
    owner: '0xOwner',
    urn: 'urn',
    isPublished: false,
    isApproved: false,
    itemCount: 1,
    minters: ['0xMinter'],
    managers: ['0xManager'],
    createdAt: 1,
    updatedAt: 1
  }
  const item = fromRemoteItem({ ...remote, eth_address: '0xCreator' })

  it('lets the item creator, the collection owner and its collaborators manage the item', () => {
    expect(canManageItem(collection, item, '0xcreator')).toBe(true)
    expect(canManageItem(collection, item, '0xowner')).toBe(true)
    expect(canManageItem(collection, item, '0xmanager')).toBe(true)
  })

  it('keeps minters and strangers out', () => {
    expect(canManageItem(collection, item, '0xminter')).toBe(false)
    expect(canManageItem(collection, item, '0xother')).toBe(false)
    expect(canManageItem(collection, item, undefined)).toBe(false)
  })
})
