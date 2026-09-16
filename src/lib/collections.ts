// Collection domain model + wire mapping for builder-server, ported from the legacy builder
// (src/modules/collection + lib/api/builder.ts) so both apps read the same API identically.

export type RemoteCollection = {
  id: string
  name: string
  eth_address: string
  salt: string | null
  contract_address: string | null
  urn: string
  is_published: boolean
  is_approved: boolean
  minters: string[]
  managers: string[]
  forum_link: string | null
  lock: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  item_count?: string
  linked_contract_address: string | null
  linked_contract_network: string | null
  is_mapping_complete: boolean
  is_programmatic?: boolean
}

export type Collection = {
  id: string
  name: string
  owner: string
  contractAddress?: string
  urn: string
  salt?: string
  isPublished: boolean
  isApproved: boolean
  itemCount: number
  minters: string[]
  managers: string[]
  forumLink?: string
  lock?: number
  reviewedAt?: number
  linkedContractAddress?: string
  linkedContractNetwork?: string
  createdAt: number
  updatedAt: number
  isMappingComplete?: boolean
  isProgrammatic?: boolean
}

export enum CollectionType {
  STANDARD = 'standard',
  THIRD_PARTY = 'third_party'
}

export enum CollectionSort {
  MOST_RELEVANT = 'MOST_RELEVANT',
  NAME_DESC = 'NAME_DESC',
  NAME_ASC = 'NAME_ASC',
  CREATED_AT_DESC = 'CREATED_AT_DESC',
  CREATED_AT_ASC = 'CREATED_AT_ASC',
  UPDATED_AT_DESC = 'UPDATED_AT_DESC',
  UPDATED_AT_ASC = 'UPDATED_AT_ASC'
}

export enum CurationStatus {
  UNDER_REVIEW = 'under_review',
  TO_REVIEW = 'to_review',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISABLED = 'disabled'
}

/** The status a collection card/row displays, derived from the list response alone. */
export enum CollectionDisplayStatus {
  PUBLISHED = 'published',
  UNDER_REVIEW = 'under_review',
  DRAFT = 'draft'
}

/** The page's status filter chips. Values double as the `status` URL param. */
export enum CollectionStatusFilter {
  ALL = 'all',
  PUBLISHED = 'published',
  SUBMITTED = 'submitted',
  DRAFT = 'draft',
  REJECTED = 'rejected'
}

export type FetchCollectionsParams = {
  page?: number
  limit?: number
  q?: string
  type?: CollectionType
  sort?: CollectionSort
  status?: CurationStatus
  isPublished?: boolean
}

export type PaginationStats = { total: number; limit: number; page: number; pages: number }
export type PaginatedResource<T> = { results: T[] } & PaginationStats

export function fromRemoteCollection(remote: RemoteCollection): Collection {
  const collection: Collection = {
    id: remote.id,
    name: remote.name,
    owner: remote.eth_address,
    urn: remote.urn,
    isPublished: remote.is_published,
    isApproved: remote.is_approved,
    itemCount: Number(remote.item_count ?? 0),
    minters: remote.minters || [],
    managers: remote.managers || [],
    forumLink: remote.forum_link || undefined,
    lock: remote.lock ? +new Date(remote.lock) : undefined,
    reviewedAt: remote.reviewed_at ? +new Date(remote.reviewed_at) : undefined,
    linkedContractAddress: remote.linked_contract_address || undefined,
    linkedContractNetwork: remote.linked_contract_network || undefined,
    createdAt: +new Date(remote.created_at),
    updatedAt: +new Date(remote.updated_at),
    isMappingComplete: remote.is_mapping_complete,
    isProgrammatic: remote.is_programmatic
  }
  if (remote.salt) collection.salt = remote.salt
  if (remote.contract_address) collection.contractAddress = remote.contract_address
  return collection
}

// Snake_case query params, falsy values dropped — matches the legacy builder's serializer, so
// builder-server receives byte-identical requests.
export function toCollectionsQueryString(params: FetchCollectionsParams): string {
  const query = new URLSearchParams()
  if (params.isPublished !== undefined) query.append('is_published', String(params.isPublished))
  if (params.status) query.append('status', params.status)
  if (params.type) query.append('type', params.type)
  if (params.sort) query.append('sort', params.sort)
  if (params.q) query.append('q', params.q)
  if (params.page) query.append('page', String(params.page))
  if (params.limit) query.append('limit', String(params.limit))
  const s = query.toString()
  return s ? `?${s}` : ''
}

/** Extra fetch params each status filter chip translates to. */
export function statusFilterToParams(filter: CollectionStatusFilter): Partial<FetchCollectionsParams> {
  switch (filter) {
    case CollectionStatusFilter.PUBLISHED:
      return { isPublished: true }
    case CollectionStatusFilter.DRAFT:
      return { isPublished: false }
    case CollectionStatusFilter.SUBMITTED:
      return { status: CurationStatus.UNDER_REVIEW }
    case CollectionStatusFilter.REJECTED:
      return { status: CurationStatus.REJECTED }
    default:
      return {}
  }
}

export function getCollectionDisplayStatus(collection: Collection): CollectionDisplayStatus {
  // A locked draft has its publish transaction in flight: the server just hasn't seen it yet.
  if (!collection.isPublished) {
    return isCollectionLocked(collection) ? CollectionDisplayStatus.UNDER_REVIEW : CollectionDisplayStatus.DRAFT
  }
  return collection.isApproved ? CollectionDisplayStatus.PUBLISHED : CollectionDisplayStatus.UNDER_REVIEW
}

/**
 * Published and approved at least once: the collection is on the market even while a later change of
 * its items is being reviewed again. The contract stamps `reviewedAt` with `createdAt` on creation,
 * so only a later review counts.
 */
export function hasBeenApproved(collection: Collection): boolean {
  if (!collection.isPublished) return false
  if (collection.isApproved) return true
  return collection.reviewedAt !== undefined && collection.reviewedAt !== collection.createdAt
}

export enum CollectionRole {
  COLLABORATOR = 'collaborator',
  MINTER = 'minter'
}

/** The non-owner role that gives this address access to the collection, if any. Collaborator wins over minter. */
export function getCollectionRole(collection: Collection, address: string): CollectionRole | null {
  const target = address.toLowerCase()
  if (collection.owner.toLowerCase() === target) return null
  if (collection.managers.some(manager => manager.toLowerCase() === target)) return CollectionRole.COLLABORATOR
  if (collection.minters.some(minter => minter.toLowerCase() === target)) return CollectionRole.MINTER
  return null
}

// Same limit as the legacy builder's standard collections (the server schema allows 42, but the
// legacy UI caps standard collections at 32 and we keep that contract).
export const COLLECTION_NAME_MAX_LENGTH = 32

// The exact error string builder-server answers when the (globally unique, case-insensitive)
// collection name is taken — the legacy front end string-matches it too.
export const NAME_ALREADY_IN_USE_ERROR = 'Name already in use'

export type CollectionNameError = 'empty' | 'too_long' | 'invalid_character'

// Same rules the legacy builder enforces: non-empty, ≤32 chars, and no ':' (names feed URNs).
export function validateCollectionName(name: string): CollectionNameError | null {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  if (trimmed.length > COLLECTION_NAME_MAX_LENGTH) return 'too_long'
  if (trimmed.includes(':')) return 'invalid_character'
  return null
}

/** Whether the collection is under the one-day publish lock (legacy `isLocked`). */
export function isCollectionLocked(collection: Collection, now = Date.now()): boolean {
  if (!collection.lock || collection.isPublished) return false
  const DAY = 24 * 60 * 60 * 1000
  return collection.lock + DAY > now
}

// The PUT payload shape, mirroring the legacy toRemoteCollection: is_published/is_approved are
// forced false because the server rejects attempts to change them through an upsert.
export function toRemoteCollection(
  collection: Collection
): Omit<RemoteCollection, 'created_at' | 'updated_at' | 'lock' | 'is_mapping_complete'> {
  return {
    id: collection.id,
    name: collection.name,
    eth_address: collection.owner,
    salt: collection.salt || null,
    contract_address: collection.contractAddress || null,
    urn: collection.urn,
    is_published: false,
    is_approved: false,
    linked_contract_address: collection.linkedContractAddress || null,
    linked_contract_network: collection.linkedContractNetwork || null,
    minters: collection.minters,
    managers: collection.managers,
    forum_link: collection.forumLink || null,
    reviewed_at: collection.reviewedAt ? new Date(collection.reviewedAt).toISOString() : null
  }
}

/** The latest curation request of a collection; only its status matters here. */
export type CollectionCuration = { status: CurationStatus }

/**
 * Whether this address is the owner, a collaborator or a minter of the collection. builder-server
 * serves published collections to anyone, so this is the app's own gate: the detail page (and later
 * the editor) shows "not found" to addresses with no role instead of a read-only view.
 */
export function hasCollectionRole(collection: Collection, address: string | undefined): boolean {
  if (!address) return false
  return collection.owner.toLowerCase() === address.toLowerCase() || getCollectionRole(collection, address) !== null
}

/** Owners and collaborators (managers) may change a collection's items; minters only sell them. */
export function canManageCollectionItems(collection: Collection, address: string | undefined): boolean {
  if (!address) return false
  const isOwner = collection.owner.toLowerCase() === address.toLowerCase()
  return isOwner || getCollectionRole(collection, address) === CollectionRole.COLLABORATOR
}

/**
 * Only the collection's creator may sell its items: the off-chain marketplace rejects a primary order
 * whose signer is not the creator (`NotCreator`), and enabling sales edits the contract's minters,
 * which is creator-only as well.
 */
export function canSellCollectionItems(collection: Collection, address: string | undefined): boolean {
  if (!address) return false
  return collection.owner.toLowerCase() === address.toLowerCase()
}
