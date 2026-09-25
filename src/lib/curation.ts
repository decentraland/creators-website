// Curation domain: the committee's review requests on standard collections, ported from the legacy
// builder (modules/curations, modules/committee, CurationPage) against the same builder-server API.
import { CollectionSort, CollectionType, hasBeenApproved, type Collection } from '~/lib/collections'

export type CurationRequestStatus = 'pending' | 'approved' | 'rejected'

export type RemoteCollectionCuration = {
  id: string
  collection_id: string
  status: CurationRequestStatus
  assignee?: string | null
  created_at: string
  updated_at: string
}

export type CollectionCuration = {
  id: string
  collectionId: string
  status: CurationRequestStatus
  assignee: string | null
  createdAt: number
  updatedAt: number
}

export function fromRemoteCuration(remote: RemoteCollectionCuration): CollectionCuration {
  return {
    id: remote.id,
    collectionId: remote.collection_id,
    status: remote.status,
    assignee: remote.assignee ? remote.assignee.toLowerCase() : null,
    createdAt: +new Date(remote.created_at),
    updatedAt: +new Date(remote.updated_at)
  }
}

export function isCommitteeMember(members: string[] | undefined, address: string | undefined): boolean {
  if (!members || !address) return false
  const target = address.toLowerCase()
  return members.some(member => member.toLowerCase() === target)
}

export enum CurationState {
  TO_REVIEW = 'to_review',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISABLED = 'disabled'
}

/** What the committee sees for a collection, from its on-chain approval and its latest review request. */
export function getCurationState(collection: Collection, curation: CollectionCuration | null): CurationState {
  if (collection.isApproved) {
    if (!curation || curation.status === 'approved') return CurationState.APPROVED
    if (curation.status === 'rejected') return CurationState.REJECTED
  } else {
    if (!curation && hasBeenApproved(collection)) return CurationState.DISABLED
    if (curation?.status === 'rejected') return CurationState.REJECTED
  }
  if (curation?.status === 'pending' && curation.assignee) return CurationState.UNDER_REVIEW
  return CurationState.TO_REVIEW
}

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  ENABLE = 'enable',
  DISABLE = 'disable',
  DEPLOY_MISSING = 'deploy_missing'
}

/** The review bar's buttons, in display order (legacy TopPanel.renderButtons). */
export function getReviewActions(
  collection: Collection,
  curation: CollectionCuration | null,
  hasMissingEntities: boolean
): ReviewAction[] {
  const disable = hasMissingEntities ? [ReviewAction.DISABLE, ReviewAction.DEPLOY_MISSING] : [ReviewAction.DISABLE]
  if (collection.isApproved) {
    return curation?.status === 'pending' ? [ReviewAction.APPROVE, ReviewAction.REJECT] : disable
  }
  if (hasBeenApproved(collection)) return [ReviewAction.ENABLE]
  // A rejected first review can still be approved later, like in the legacy builder.
  return curation?.status === 'rejected' ? [ReviewAction.APPROVE] : [ReviewAction.APPROVE, ReviewAction.REJECT]
}

/** The pencil on an assignee: gone once the collection and its latest request are both approved. */
export function canEditAssignee(collection: Collection, curation: CollectionCuration | null): boolean {
  return !(collection.isApproved && curation?.status === 'approved')
}

export enum CurationStatusFilter {
  ALL = 'all',
  TO_REVIEW = 'to_review',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export const CURATION_SORTS = [
  CollectionSort.MOST_RELEVANT,
  CollectionSort.CREATED_AT_DESC,
  CollectionSort.NAME_ASC,
  CollectionSort.NAME_DESC
] as const
export type CurationSort = (typeof CURATION_SORTS)[number]

export const ALL_ASSIGNEES = 'all'
export const CURATION_PAGE_SIZE = 12

export type CurationFilters = {
  page: number
  search: string
  status: CurationStatusFilter
  assignee: string
  sort: CurationSort
  tag: string | null
}

/** The page's filters as they live in the URL; unknown values fall back to the defaults. */
export function parseCurationFilters(params: URLSearchParams): CurationFilters {
  const status = params.get('status') as CurationStatusFilter
  const sort = params.get('sort') as CurationSort
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    search: params.get('q') ?? '',
    status: Object.values(CurationStatusFilter).includes(status) ? status : CurationStatusFilter.ALL,
    assignee: params.get('assignee')?.toLowerCase() || ALL_ASSIGNEES,
    sort: CURATION_SORTS.includes(sort) ? sort : CollectionSort.MOST_RELEVANT,
    tag: params.get('tag') || null
  }
}

/** GET /collections query string for the curation list; always published standard collections. */
export function toCurationQueryString(filters: CurationFilters, limit = CURATION_PAGE_SIZE): string {
  const query = new URLSearchParams()
  query.append('is_published', 'true')
  if (filters.assignee !== ALL_ASSIGNEES) query.append('assignee', filters.assignee)
  if (filters.status !== CurationStatusFilter.ALL) query.append('status', filters.status)
  query.append('type', CollectionType.STANDARD)
  query.append('sort', filters.sort)
  if (filters.search) query.append('q', filters.search)
  if (filters.tag) query.append('tag', filters.tag.toLowerCase())
  query.append('page', String(filters.page))
  query.append('limit', String(limit))
  return `?${query.toString()}`
}

/** Committee members for the assignee pickers: the signed-in curator first, the rest as the server lists them. */
export function orderCurators(members: string[], address: string | undefined): string[] {
  const self = address?.toLowerCase()
  const lower = members.map(member => member.toLowerCase())
  return self && lower.includes(self) ? [self, ...lower.filter(member => member !== self)] : lower
}
