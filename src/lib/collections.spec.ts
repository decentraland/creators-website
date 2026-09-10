import { describe, it, expect } from 'vitest'
import {
  COLLECTION_NAME_MAX_LENGTH,
  CollectionDisplayStatus,
  canManageCollectionItems,
  CollectionSort,
  CollectionStatusFilter,
  CollectionType,
  CurationStatus,
  fromRemoteCollection,
  getCollectionDisplayStatus,
  getCollectionRole,
  CollectionRole,
  hasBeenApproved,
  isCollectionLocked,
  statusFilterToParams,
  toCollectionsQueryString,
  toRemoteCollection,
  validateCollectionName,
  type Collection,
  type RemoteCollection
} from './collections'

const remote: RemoteCollection = {
  id: 'a1b2',
  name: 'Pirate Hats',
  eth_address: '0xAbC0000000000000000000000000000000000001',
  salt: '0xsalt',
  contract_address: '0xcontract',
  urn: 'urn:decentraland:matic:collections-v2:0xcontract',
  is_published: true,
  is_approved: true,
  minters: ['0xminter'],
  managers: [],
  forum_link: null,
  lock: null,
  reviewed_at: '2026-04-01T10:00:00Z',
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-04-02T10:00:00Z',
  item_count: '250',
  linked_contract_address: null,
  linked_contract_network: null,
  is_mapping_complete: true
}

describe('fromRemoteCollection', () => {
  it('maps the wire shape to the domain model with epoch dates and a numeric item count', () => {
    const collection = fromRemoteCollection(remote)
    expect(collection).toMatchObject({
      id: 'a1b2',
      name: 'Pirate Hats',
      owner: remote.eth_address,
      contractAddress: '0xcontract',
      salt: '0xsalt',
      isPublished: true,
      isApproved: true,
      itemCount: 250,
      minters: ['0xminter']
    })
    expect(collection.createdAt).toBe(+new Date('2026-03-01T10:00:00Z'))
    expect(collection.updatedAt).toBe(+new Date('2026-04-02T10:00:00Z'))
    expect(collection.reviewedAt).toBe(+new Date('2026-04-01T10:00:00Z'))
    expect(collection.lock).toBeUndefined()
  })

  it('treats a missing item_count as zero and omits empty optionals', () => {
    const collection = fromRemoteCollection({
      ...remote,
      item_count: undefined,
      salt: null,
      contract_address: null,
      forum_link: null,
      reviewed_at: null
    })
    expect(collection.itemCount).toBe(0)
    expect(collection.salt).toBeUndefined()
    expect(collection.contractAddress).toBeUndefined()
    expect(collection.forumLink).toBeUndefined()
    expect(collection.reviewedAt).toBeUndefined()
  })
})

describe('toCollectionsQueryString', () => {
  it('serializes to the snake_case params builder-server expects, dropping absent ones', () => {
    expect(
      toCollectionsQueryString({
        page: 2,
        limit: 20,
        q: 'hat',
        type: CollectionType.STANDARD,
        sort: CollectionSort.CREATED_AT_DESC,
        isPublished: true
      })
    ).toBe('?is_published=true&type=standard&sort=CREATED_AT_DESC&q=hat&page=2&limit=20')
  })

  it('serializes is_published=false and returns an empty string with no params', () => {
    expect(toCollectionsQueryString({ isPublished: false })).toBe('?is_published=false')
    expect(toCollectionsQueryString({})).toBe('')
  })
})

describe('statusFilterToParams', () => {
  it('maps each chip to its server-side filter', () => {
    expect(statusFilterToParams(CollectionStatusFilter.ALL)).toEqual({})
    expect(statusFilterToParams(CollectionStatusFilter.PUBLISHED)).toEqual({ isPublished: true })
    expect(statusFilterToParams(CollectionStatusFilter.DRAFT)).toEqual({ isPublished: false })
    expect(statusFilterToParams(CollectionStatusFilter.SUBMITTED)).toEqual({ status: CurationStatus.UNDER_REVIEW })
    expect(statusFilterToParams(CollectionStatusFilter.REJECTED)).toEqual({ status: CurationStatus.REJECTED })
  })
})

describe('getCollectionDisplayStatus', () => {
  const base = fromRemoteCollection(remote)
  const withFlags = (isPublished: boolean, isApproved: boolean): Collection => ({ ...base, isPublished, isApproved })

  it('derives the badge from the publish/approve flags', () => {
    expect(getCollectionDisplayStatus(withFlags(true, true))).toBe(CollectionDisplayStatus.PUBLISHED)
    expect(getCollectionDisplayStatus(withFlags(true, false))).toBe(CollectionDisplayStatus.UNDER_REVIEW)
    expect(getCollectionDisplayStatus(withFlags(false, false))).toBe(CollectionDisplayStatus.DRAFT)
  })
})

describe('hasBeenApproved', () => {
  const base = fromRemoteCollection(remote)

  it('is true for an approved collection and for one reviewed before that is under review again', () => {
    expect(hasBeenApproved({ ...base, isPublished: true, isApproved: true })).toBe(true)
    expect(hasBeenApproved({ ...base, isPublished: true, isApproved: false, reviewedAt: 1 })).toBe(true)
  })

  it('is false for drafts and for a first review', () => {
    expect(hasBeenApproved({ ...base, isPublished: false, isApproved: false })).toBe(false)
    expect(hasBeenApproved({ ...base, isPublished: true, isApproved: false, reviewedAt: undefined })).toBe(false)
  })
})

describe('getCollectionRole', () => {
  const base: Collection = {
    ...fromRemoteCollection(remote),
    owner: '0xOwner',
    managers: ['0xManager'],
    minters: ['0xMinter', '0xManager']
  }

  it('reports collaborator or minter for non-owners, case-insensitively', () => {
    expect(getCollectionRole(base, '0xmanager')).toBe(CollectionRole.COLLABORATOR)
    expect(getCollectionRole(base, '0xMINTER')).toBe(CollectionRole.MINTER)
  })

  it('reports no role for the owner or a stranger', () => {
    expect(getCollectionRole(base, '0xowner')).toBeNull()
    expect(getCollectionRole(base, '0xother')).toBeNull()
  })
})

describe('validateCollectionName', () => {
  it('rejects empty, over-long and colon-containing names, accepts the rest', () => {
    expect(validateCollectionName('')).toBe('empty')
    expect(validateCollectionName('   ')).toBe('empty')
    expect(validateCollectionName('a'.repeat(COLLECTION_NAME_MAX_LENGTH + 1))).toBe('too_long')
    expect(validateCollectionName('urn:like')).toBe('invalid_character')
    expect(validateCollectionName('Pirate Hats')).toBeNull()
    expect(validateCollectionName('a'.repeat(COLLECTION_NAME_MAX_LENGTH))).toBeNull()
  })
})

describe('isCollectionLocked', () => {
  const base = fromRemoteCollection(remote)
  const HOUR = 3_600_000

  it('locks for a day after the lock timestamp, unless published', () => {
    const now = Date.now()
    const draft = { ...base, isPublished: false }
    expect(isCollectionLocked({ ...draft, lock: now - HOUR }, now)).toBe(true)
    expect(isCollectionLocked({ ...draft, lock: now - 25 * HOUR }, now)).toBe(false)
    expect(isCollectionLocked({ ...draft, lock: undefined }, now)).toBe(false)
    expect(isCollectionLocked({ ...base, isPublished: true, lock: now - HOUR }, now)).toBe(false)
  })
})

describe('toRemoteCollection', () => {
  it('maps to the snake_case upsert payload, forcing the publish flags off', () => {
    const collection = fromRemoteCollection(remote)
    expect(toRemoteCollection(collection)).toEqual({
      id: 'a1b2',
      name: 'Pirate Hats',
      eth_address: remote.eth_address,
      salt: '0xsalt',
      contract_address: '0xcontract',
      urn: remote.urn,
      is_published: false,
      is_approved: false,
      linked_contract_address: null,
      linked_contract_network: null,
      minters: ['0xminter'],
      managers: [],
      forum_link: null,
      reviewed_at: '2026-04-01T10:00:00.000Z'
    })
  })

  it('nulls absent optionals', () => {
    const collection = fromRemoteCollection({
      ...remote,
      salt: null,
      contract_address: null,
      forum_link: null,
      reviewed_at: null
    })
    const payload = toRemoteCollection(collection)
    expect(payload.salt).toBeNull()
    expect(payload.contract_address).toBeNull()
    expect(payload.forum_link).toBeNull()
    expect(payload.reviewed_at).toBeNull()
  })
})

describe('canManageCollectionItems', () => {
  const collection: Collection = {
    id: 'c1',
    name: 'Hats',
    owner: '0xOwner',
    urn: 'urn',
    isPublished: false,
    isApproved: false,
    itemCount: 0,
    minters: ['0xMinter'],
    managers: ['0xManager'],
    createdAt: 1,
    updatedAt: 1
  }

  it('is granted to the owner and collaborators regardless of address casing, never to minters', () => {
    expect(canManageCollectionItems(collection, '0xowner')).toBe(true)
    expect(canManageCollectionItems(collection, '0xMANAGER')).toBe(true)
    expect(canManageCollectionItems(collection, '0xminter')).toBe(false)
    expect(canManageCollectionItems(collection, undefined)).toBe(false)
  })
})
