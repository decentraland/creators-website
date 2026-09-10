import { describe, expect, it } from 'vitest'
import { type Entity, EntityType } from '@dcl/schemas'
import { ItemType, type Item } from './items'
import { ItemSyncStatus, buildResetItem, getItemSyncStatus, isItemSynced, mapEntitiesByItemId } from './itemSync'

const MALE = 'urn:decentraland:off-chain:base-avatars:BaseMale'
const URN = 'urn:decentraland:amoy:collections-v2:0xc0ffee:0'

const wearable: Item = {
  id: 'i1',
  name: 'Pirate Hat',
  description: 'Yarr',
  thumbnail: 'thumbnail.png',
  urn: URN,
  owner: '0xabc',
  collectionId: 'c1',
  rarity: 'legendary',
  isPublished: true,
  isApproved: true,
  inCatalyst: true,
  type: ItemType.WEARABLE,
  data: {
    category: 'hat',
    hides: [],
    replaces: ['helmet'],
    tags: ['pirate'],
    representations: [{ bodyShapes: [MALE], mainFile: 'hat.glb', contents: ['hat.glb', 'textures/'] }]
  },
  contents: {
    'hat.glb': 'Qmglb',
    'thumbnail.png': 'Qmthumb',
    'image.png': 'Qmimage',
    'textures/': 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
  },
  createdAt: 1000,
  updatedAt: 1000
}

function entityFor(item: Item, metadataOverrides: Record<string, unknown> = {}, contents = item.contents): Entity {
  const deployed = Object.fromEntries(Object.entries(contents).filter(([path]) => !path.endsWith('/')))
  const data = {
    ...item.data,
    representations: item.data.representations.map(rep => ({
      ...rep,
      contents: rep.contents.filter(path => !path.endsWith('/'))
    }))
  }
  const metadata =
    item.type === ItemType.EMOTE
      ? { id: item.urn, name: item.name, description: item.description, emoteDataADR74: data }
      : { id: item.urn, name: item.name, description: item.description, data }
  return {
    version: 'v3',
    id: 'bafyentity',
    type: EntityType.WEARABLE,
    pointers: [item.urn!],
    timestamp: 1,
    content: Object.entries(deployed).map(([file, hash]) => ({ file, hash })),
    metadata: { ...metadata, ...metadataOverrides }
  }
}

const emote: Item = {
  ...wearable,
  id: 'e1',
  urn: `${URN}1`,
  type: ItemType.EMOTE,
  data: {
    category: 'dance',
    loop: true,
    tags: [],
    representations: [{ bodyShapes: [MALE], mainFile: 'e.glb', contents: ['e.glb'] }]
  },
  contents: { 'e.glb': 'Qme', 'thumbnail.png': 'Qmthumb' }
}

describe('isItemSynced', () => {
  it('is synced when metadata, representations and deployed files all match', () => {
    expect(isItemSynced(wearable, entityFor(wearable))).toBe(true)
    expect(isItemSynced(emote, entityFor(emote))).toBe(true)
  })

  it('ignores directory entries, which are never deployed', () => {
    const entity = entityFor(wearable)
    expect(entity.content.some(({ file }) => file === 'textures/')).toBe(false)
    expect(isItemSynced(wearable, entity)).toBe(true)
  })

  it('is out of sync after renaming or re-describing the item', () => {
    expect(isItemSynced({ ...wearable, name: 'Corsair Hat' }, entityFor(wearable))).toBe(false)
    expect(isItemSynced({ ...wearable, description: 'Arr' }, entityFor(wearable))).toBe(false)
  })

  it('is out of sync when a wearable field changes', () => {
    const entity = entityFor(wearable)
    expect(isItemSynced({ ...wearable, data: { ...wearable.data, category: 'helmet' } }, entity)).toBe(false)
    expect(isItemSynced({ ...wearable, data: { ...wearable.data, replaces: [] } }, entity)).toBe(false)
    expect(isItemSynced({ ...wearable, data: { ...wearable.data, tags: ['pirate', 'hat'] } }, entity)).toBe(false)
  })

  it('is out of sync when an emote changes its play mode', () => {
    expect(isItemSynced({ ...emote, data: { ...emote.data, loop: false } }, entityFor(emote))).toBe(false)
  })

  it('is out of sync when a file was replaced', () => {
    expect(
      isItemSynced({ ...wearable, contents: { ...wearable.contents, 'hat.glb': 'Qmnew' } }, entityFor(wearable))
    ).toBe(false)
  })

  it('is out of sync when a representation was added', () => {
    const FEMALE = 'urn:decentraland:off-chain:base-avatars:BaseFemale'
    const representations = [
      ...wearable.data.representations,
      { bodyShapes: [FEMALE], mainFile: 'hat.glb', contents: ['hat.glb'] }
    ]
    expect(isItemSynced({ ...wearable, data: { ...wearable.data, representations } }, entityFor(wearable))).toBe(false)
  })

  it('is out of sync when a representation gains or drops per-representation overrides', () => {
    const [rep] = wearable.data.representations
    const withOverrides = {
      ...wearable,
      data: { ...wearable.data, representations: [{ ...rep, overrideHides: ['hair'] }] }
    }
    expect(isItemSynced(withOverrides, entityFor(wearable))).toBe(false)
    expect(isItemSynced(wearable, entityFor(withOverrides))).toBe(false)
    expect(isItemSynced(withOverrides, entityFor(withOverrides))).toBe(true)
  })

  it('does not confuse a tag containing a comma with two tags', () => {
    expect(
      isItemSynced(
        { ...wearable, data: { ...wearable.data, tags: ['pirate,hat'] } },
        entityFor({ ...wearable, data: { ...wearable.data, tags: ['pirate', 'hat'] } })
      )
    ).toBe(false)
  })

  it('treats an emote deployed before ADR-74 as out of sync', () => {
    const legacy = entityFor(emote, { emoteDataADR74: undefined, data: emote.data })
    expect(isItemSynced(emote, legacy)).toBe(false)
  })
})

describe('getItemSyncStatus', () => {
  const loaded = { isCurationPending: false, entitiesLoaded: true }

  it('is synced or unsynced by comparing with the entity', () => {
    expect(getItemSyncStatus(wearable, entityFor(wearable), loaded)).toBe(ItemSyncStatus.SYNCED)
    expect(getItemSyncStatus({ ...wearable, name: 'x' }, entityFor(wearable), loaded)).toBe(ItemSyncStatus.UNSYNCED)
  })

  it('is under review, not unsynced, while the committee has a pending request for the collection', () => {
    const status = getItemSyncStatus({ ...wearable, name: 'x' }, entityFor(wearable), {
      ...loaded,
      isCurationPending: true
    })
    expect(status).toBe(ItemSyncStatus.UNDER_REVIEW)
  })

  it('follows the publication flags when nothing is deployed', () => {
    expect(getItemSyncStatus({ ...wearable, isPublished: false }, undefined, loaded)).toBe(ItemSyncStatus.UNPUBLISHED)
    expect(getItemSyncStatus({ ...wearable, isApproved: false }, undefined, loaded)).toBe(ItemSyncStatus.UNDER_REVIEW)
  })

  it('is unsynced when an approved item has no entity, but loading until the entities arrive', () => {
    expect(getItemSyncStatus(wearable, undefined, loaded)).toBe(ItemSyncStatus.UNSYNCED)
    expect(getItemSyncStatus(wearable, undefined, { ...loaded, entitiesLoaded: false })).toBe(ItemSyncStatus.LOADING)
  })
})

describe('mapEntitiesByItemId', () => {
  it('pairs each entity with the item sharing its URN', () => {
    const map = mapEntitiesByItemId([wearable, emote], [entityFor(emote)])
    expect(map.get('e1')?.pointers).toEqual([emote.urn])
    expect(map.has('i1')).toBe(false)
  })
})

describe('buildResetItem', () => {
  it('takes name, description, item data and files from the deployed entity', () => {
    const edited: Item = {
      ...wearable,
      name: 'Corsair Hat',
      description: 'Arr',
      data: { ...wearable.data, category: 'helmet' },
      contents: { ...wearable.contents, 'hat.glb': 'Qmnew', 'extra.png': 'Qmextra' }
    }
    const reset = buildResetItem(edited, entityFor(wearable))
    expect(reset).toMatchObject({ id: 'i1', name: 'Pirate Hat', description: 'Yarr', rarity: 'legendary' })
    expect(reset.data.category).toBe('hat')
    expect(reset.contents).toEqual({ 'hat.glb': 'Qmglb', 'thumbnail.png': 'Qmthumb', 'image.png': 'Qmimage' })
  })

  it('takes the ADR-74 data for an emote', () => {
    const reset = buildResetItem({ ...emote, data: { ...emote.data, loop: false } }, entityFor(emote))
    expect(reset.data.loop).toBe(true)
  })
})
