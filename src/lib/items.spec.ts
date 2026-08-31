import { describe, it, expect } from 'vitest'
import { CollectionDisplayStatus } from './collections'
import {
  BodyShapeType,
  fromRemoteItem,
  getItemBodyShapeType,
  getItemDisplayStatus,
  getItemMetadata,
  ItemType,
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
