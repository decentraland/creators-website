// Curation domain: the committee's review requests on standard collections, ported from the legacy
// builder (modules/curations, modules/committee, CurationPage) against the same builder-server API.
import { CollectionSort, CollectionType, hasBeenApproved, type Collection } from '~/lib/collections'
import { isRejectReasonCode, type CollectionEvent, type RejectReasonCode } from '~/lib/events'

export type CurationRequestStatus = 'pending' | 'approved' | 'rejected'

export type RemoteCollectionCuration = {
  id: string
  collection_id: string
  status: CurationRequestStatus
  assignee?: string | null
  reviewed_by?: string | null
  rejection_reasons?: string[] | null
  rejection_message?: string | null
  created_at: string
  updated_at: string
}

/** `reviewed_by` value when the automatic review, not a committee member, decided. */
export const VALIDATOR_REVIEWER = 'validator'

export type CollectionCuration = {
  id: string
  collectionId: string
  status: CurationRequestStatus
  assignee: string | null
  /** `'validator'`, the deciding curator's lowercase address, or `null` while pending (and on legacy rows). */
  reviewedBy: string | null
  rejectionReasons: RejectReasonCode[] | null
  rejectionMessage: string | null
  createdAt: number
  updatedAt: number
}

function toRejectReasons(codes: string[] | null | undefined): RejectReasonCode[] | null {
  if (!codes) return null
  return codes.filter(isRejectReasonCode)
}

export function fromRemoteCuration(remote: RemoteCollectionCuration): CollectionCuration {
  return {
    id: remote.id,
    collectionId: remote.collection_id,
    status: remote.status,
    assignee: remote.assignee ? remote.assignee.toLowerCase() : null,
    reviewedBy: remote.reviewed_by ? remote.reviewed_by.toLowerCase() : null,
    rejectionReasons: toRejectReasons(remote.rejection_reasons),
    rejectionMessage: remote.rejection_message ?? null,
    createdAt: +new Date(remote.created_at),
    updatedAt: +new Date(remote.updated_at)
  }
}

export enum ReviewStage {
  AI_REVIEWING = 'ai_reviewing',
  AWAITING_CURATOR = 'awaiting_curator',
  REJECTED_BY_VALIDATOR = 'rejected_by_validator',
  APPEALED = 'appealed',
  REJECTED_BY_CURATOR = 'rejected_by_curator',
  APPROVED = 'approved'
}

/** Events that say nothing about the stage: an assignment or a submitted change leaves the review where it was. */
const STAGE_NEUTRAL_EVENTS = new Set(['review.assigned', 'review.human_required', 'changes.submitted'])

/**
 * Where the review stands, from the latest request and the newest stage-defining timeline event (the frozen
 * curation contract's table). `events` newest first. `null` when the rows predate the timeline or the stage
 * is not one of these: callers fall back to the legacy curation state.
 */
export function getReviewStage(curation: CollectionCuration | null, events: CollectionEvent[]): ReviewStage | null {
  if (!curation) return null
  if (curation.status === 'approved') return ReviewStage.APPROVED
  if (curation.status === 'rejected') {
    if (curation.reviewedBy === VALIDATOR_REVIEWER) return ReviewStage.REJECTED_BY_VALIDATOR
    return curation.reviewedBy ? ReviewStage.REJECTED_BY_CURATOR : null
  }
  const latest = events.find(event => !STAGE_NEUTRAL_EVENTS.has(event.type))
  switch (latest?.type) {
    case 'review.ai_started':
    case 'review.ai_error':
      return ReviewStage.AI_REVIEWING
    case 'review.ai_passed':
      return ReviewStage.AWAITING_CURATOR
    case 'review.appeal_requested':
      return ReviewStage.APPEALED
    default:
      return null
  }
}

/** Stages in which the creator may ask for another automatic review or a human one. */
export function isRejectedStage(stage: ReviewStage | null): boolean {
  return stage === ReviewStage.REJECTED_BY_VALIDATOR || stage === ReviewStage.REJECTED_BY_CURATOR
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

export type CreatorReviewNotice = 'waiting' | 'reviewing' | 'rejected'

/** What the creator is told about a published collection's latest review request, if anything. */
export function getCreatorReviewNotice(
  collection: Collection,
  curation: CollectionCuration | null
): CreatorReviewNotice | null {
  if (!collection.isPublished || !curation) return null
  if (curation.status === 'pending') return curation.assignee ? 'reviewing' : 'waiting'
  return curation.status === 'rejected' ? 'rejected' : null
}

/** Owners and collaborators may send an approved collection's unsynced changes back to the committee. */
export function canPushChanges(
  collection: Collection,
  curation: CollectionCuration | null,
  hasUnsyncedItems: boolean,
  canManage: boolean
): boolean {
  return (
    collection.isPublished && collection.isApproved && canManage && hasUnsyncedItems && curation?.status !== 'pending'
  )
}
