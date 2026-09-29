import { describe, expect, it } from 'vitest'
import { CollectionSort, type Collection } from './collections'
import {
  CurationState,
  CurationStatusFilter,
  ReviewAction,
  ReviewStage,
  canEditAssignee,
  canPushChanges,
  fromRemoteCuration,
  getCreatorReviewNotice,
  getCurationState,
  getReviewActions,
  getReviewStage,
  isCommitteeMember,
  orderCurators,
  parseCurationFilters,
  toCurationQueryString,
  type CollectionCuration
} from './curation'

const CREATED = 1_700_000_000_000

function collection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'c1',
    name: 'Hats',
    owner: '0xowner',
    urn: 'urn',
    isPublished: true,
    isApproved: false,
    itemCount: 2,
    minters: [],
    managers: [],
    reviewedAt: CREATED,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides
  }
}

function curation(overrides: Partial<CollectionCuration> = {}): CollectionCuration {
  return {
    id: 'r1',
    collectionId: 'c1',
    status: 'pending',
    assignee: null,
    reviewedBy: null,
    rejectionReasons: null,
    rejectionMessage: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides
  }
}

const reviewedBefore = { reviewedAt: CREATED + 1000 }

describe('fromRemoteCuration', () => {
  it('maps the row and lowercases the assignee', () => {
    expect(
      fromRemoteCuration({
        id: 'r1',
        collection_id: 'c1',
        status: 'pending',
        assignee: '0xABC',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z'
      })
    ).toEqual({
      id: 'r1',
      collectionId: 'c1',
      status: 'pending',
      assignee: '0xabc',
      reviewedBy: null,
      rejectionReasons: null,
      rejectionMessage: null,
      createdAt: Date.parse('2026-01-01T00:00:00Z'),
      updatedAt: Date.parse('2026-01-02T00:00:00Z')
    })
  })
})

describe('isCommitteeMember', () => {
  it('matches addresses case-insensitively and fails closed without data', () => {
    expect(isCommitteeMember(['0xabc'], '0xABC')).toBe(true)
    expect(isCommitteeMember(['0xabc'], '0xdef')).toBe(false)
    expect(isCommitteeMember(undefined, '0xabc')).toBe(false)
    expect(isCommitteeMember(['0xabc'], undefined)).toBe(false)
  })
})

describe('getCurationState', () => {
  it.each([
    ['a new collection nobody picked up', collection(), null, CurationState.TO_REVIEW],
    ['a pending request without a curator', collection(), curation(), CurationState.TO_REVIEW],
    ['a pending request with a curator', collection(), curation({ assignee: '0xc' }), CurationState.UNDER_REVIEW],
    ['a rejected first review', collection(), curation({ status: 'rejected' }), CurationState.REJECTED],
    ['an approved collection', collection({ isApproved: true }), null, CurationState.APPROVED],
    [
      'an approved collection with an approved request',
      collection({ isApproved: true }),
      curation({ status: 'approved' }),
      CurationState.APPROVED
    ],
    [
      'rejected pushed changes',
      collection({ isApproved: true }),
      curation({ status: 'rejected' }),
      CurationState.REJECTED
    ],
    [
      'pushed changes under review',
      collection({ isApproved: true }),
      curation({ assignee: '0xc' }),
      CurationState.UNDER_REVIEW
    ],
    ['a disabled collection', collection(reviewedBefore), null, CurationState.DISABLED]
  ])('%s', (_, subject, request, expected) => {
    expect(getCurationState(subject, request)).toBe(expected)
  })
})

describe('getReviewActions', () => {
  it('offers approve and reject on a first review', () => {
    expect(getReviewActions(collection(), null, false)).toEqual([ReviewAction.APPROVE, ReviewAction.REJECT])
    expect(getReviewActions(collection(), curation({ assignee: '0xc' }), false)).toEqual([
      ReviewAction.APPROVE,
      ReviewAction.REJECT
    ])
  })

  it('only offers approve once a first review was rejected', () => {
    expect(getReviewActions(collection(), curation({ status: 'rejected' }), false)).toEqual([ReviewAction.APPROVE])
  })

  it('offers approve and reject on pushed changes of an approved collection', () => {
    expect(getReviewActions(collection({ isApproved: true }), curation(), false)).toEqual([
      ReviewAction.APPROVE,
      ReviewAction.REJECT
    ])
  })

  it('offers disable on an approved collection, plus the deploy when entities are missing', () => {
    const approved = collection({ isApproved: true })
    expect(getReviewActions(approved, curation({ status: 'approved' }), false)).toEqual([ReviewAction.DISABLE])
    expect(getReviewActions(approved, null, true)).toEqual([ReviewAction.DISABLE, ReviewAction.DEPLOY_MISSING])
  })

  it('offers enable on a disabled collection', () => {
    expect(getReviewActions(collection(reviewedBefore), null, false)).toEqual([ReviewAction.ENABLE])
  })
})

describe('canEditAssignee', () => {
  it('locks the assignee only once both the collection and its request are approved', () => {
    expect(canEditAssignee(collection({ isApproved: true }), curation({ status: 'approved' }))).toBe(false)
    expect(canEditAssignee(collection({ isApproved: true }), curation())).toBe(true)
    expect(canEditAssignee(collection(), curation({ status: 'approved' }))).toBe(true)
  })
})

describe('curation filters', () => {
  it('reads the URL with defaults for missing or unknown values', () => {
    expect(parseCurationFilters(new URLSearchParams('status=bogus&sort=nope&page=-3'))).toEqual({
      page: 1,
      search: '',
      status: CurationStatusFilter.ALL,
      assignee: 'all',
      sort: CollectionSort.MOST_RELEVANT,
      tag: null
    })
  })

  it('builds the committee list query for published standard collections', () => {
    const filters = parseCurationFilters(
      new URLSearchParams('status=under_review&assignee=0xABC&q=hat&sort=NAME_ASC&page=2&tag=Summer')
    )
    const query = new URLSearchParams(toCurationQueryString(filters))
    expect(Object.fromEntries(query)).toEqual({
      is_published: 'true',
      assignee: '0xabc',
      status: 'under_review',
      type: 'standard',
      sort: 'NAME_ASC',
      q: 'hat',
      tag: 'summer',
      page: '2',
      limit: '12'
    })
  })

  it('leaves the "all" filters out of the query', () => {
    const query = new URLSearchParams(toCurationQueryString(parseCurationFilters(new URLSearchParams())))
    expect(query.has('status')).toBe(false)
    expect(query.has('assignee')).toBe(false)
    expect(query.has('tag')).toBe(false)
  })
})

describe('orderCurators', () => {
  it('puts the signed-in curator first', () => {
    expect(orderCurators(['0xa', '0xB', '0xc'], '0xb')).toEqual(['0xb', '0xa', '0xc'])
    expect(orderCurators(['0xa'], '0xz')).toEqual(['0xa'])
  })
})

describe('getCreatorReviewNotice', () => {
  it('tells the creator where the latest request stands', () => {
    expect(getCreatorReviewNotice(collection(), null)).toBeNull()
    expect(getCreatorReviewNotice(collection(), curation())).toBe('waiting')
    expect(getCreatorReviewNotice(collection(), curation({ assignee: '0xc' }))).toBe('reviewing')
    expect(getCreatorReviewNotice(collection(), curation({ status: 'rejected' }))).toBe('rejected')
    expect(getCreatorReviewNotice(collection({ isApproved: true }), curation({ status: 'approved' }))).toBeNull()
    expect(getCreatorReviewNotice(collection({ isPublished: false }), curation())).toBeNull()
  })
})

describe('canPushChanges', () => {
  const approved = collection({ isApproved: true })

  it('lets managers send unsynced changes of an approved collection', () => {
    expect(canPushChanges(approved, null, true, true)).toBe(true)
    expect(canPushChanges(approved, curation({ status: 'rejected' }), true, true)).toBe(true)
  })

  it('refuses while a request is pending, without changes, without rights or before approval', () => {
    expect(canPushChanges(approved, curation(), true, true)).toBe(false)
    expect(canPushChanges(approved, null, false, true)).toBe(false)
    expect(canPushChanges(approved, null, true, false)).toBe(false)
    expect(canPushChanges(collection(), null, true, true)).toBe(false)
  })
})

describe('getReviewStage', () => {
  const event = (type: string) => ({
    id: 'e',
    collectionId: 'c1',
    type,
    actor: 'validator' as const,
    actorAddress: null,
    payload: {},
    createdAt: 1
  })

  it.each([
    ['nothing without a request', null, event('review.ai_started'), null],
    ['AI reviewing while the validator works', curation(), event('review.ai_started'), ReviewStage.AI_REVIEWING],
    ['still AI reviewing after a validator error', curation(), event('review.ai_error'), ReviewStage.AI_REVIEWING],
    ['awaiting a curator once the AI passed', curation(), event('review.ai_passed'), ReviewStage.AWAITING_CURATOR],
    ['appealed', curation(), event('review.appeal_requested'), ReviewStage.APPEALED],
    ['nothing for a pending request without a telling event', curation(), event('review.assigned'), null],
    ['nothing for a pending request before the timeline', curation(), null, null],
    [
      'awaiting a curator through a later assignment',
      curation({ assignee: '0xc' }),
      [event('review.assigned'), event('changes.submitted'), event('review.ai_passed')],
      ReviewStage.AWAITING_CURATOR
    ],
    [
      'appealed through a later assignment',
      curation(),
      [event('review.assigned'), event('review.appeal_requested')],
      ReviewStage.APPEALED
    ],
    [
      'rejected by the validator',
      curation({ status: 'rejected', reviewedBy: 'validator' }),
      event('review.ai_rejected'),
      ReviewStage.REJECTED_BY_VALIDATOR
    ],
    [
      'rejected by a curator',
      curation({ status: 'rejected', reviewedBy: '0xcurator' }),
      event('review.rejected'),
      ReviewStage.REJECTED_BY_CURATOR
    ],
    ['nothing for a legacy rejection', curation({ status: 'rejected' }), null, null],
    [
      'approved',
      curation({ status: 'approved', reviewedBy: '0xcurator' }),
      event('review.approved'),
      ReviewStage.APPROVED
    ]
  ])('%s', (_, request, latest, expected) => {
    const events = latest === null ? [] : Array.isArray(latest) ? latest : [latest]
    expect(getReviewStage(request, events)).toBe(expected)
  })

  it('maps the reviewer and the rejection fields from the row', () => {
    expect(
      fromRemoteCuration({
        id: 'r1',
        collection_id: 'c1',
        status: 'rejected',
        reviewed_by: '0xCURATOR',
        rejection_reasons: ['clipping', 'bogus', 'other'],
        rejection_message: 'Fix the sleeves',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z'
      })
    ).toMatchObject({
      reviewedBy: '0xcurator',
      rejectionReasons: ['clipping', 'other'],
      rejectionMessage: 'Fix the sleeves'
    })
  })
})
