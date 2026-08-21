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
  if (!collection.isPublished) return CollectionDisplayStatus.DRAFT
  return collection.isApproved ? CollectionDisplayStatus.PUBLISHED : CollectionDisplayStatus.UNDER_REVIEW
}
