import { describe, expect, it } from 'vitest'
import { CollectionSort, type Collection } from './collections'
import {
  CurationState,
  CurationStatusFilter,
  ReviewAction,
  ReviewType,
  UNASSIGNED,
  canEditAssignee,
  canPushChanges,
  curationListUrl,
  rememberCurationSearch,
  fromRemoteCuration,
  getCurationState,
  getReviewActions,
  getReviewType,
  isCommitteeMember,
  orderCurators,
  parseCurationFilters,
  toCurationQueryString,
  toMultiParam,
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
  return { id: 'r1', collectionId: 'c1', status: 'pending', assignee: null, createdAt: 1, updatedAt: 2, ...overrides }
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
    ['a disabled collection', collection(reviewedBefore), null, CurationState.DISABLED],
    [
      'a collection disabled after its request was approved',
      collection(reviewedBefore),
      curation({ status: 'approved' }),
      CurationState.DISABLED
    ],
    [
      // Only an approved (or missing) request proves a past approval: the rescue step stamps reviewedAt too.
      'a collection disabled after its pushed changes were rejected, as the creator sees it',
      collection(reviewedBefore),
      curation({ status: 'rejected' }),
      CurationState.REJECTED
    ],
    [
      'a first review stopped after the rescue step',
      collection(reviewedBefore),
      curation({ status: 'pending', assignee: '0xc' }),
      CurationState.UNDER_REVIEW
    ],
    [
      'changes pushed on a disabled collection',
      collection(reviewedBefore),
      curation({ assignee: '0xc' }),
      CurationState.UNDER_REVIEW
    ],
    [
      // An approved request is the proof, whatever reviewedAt says.
      'an approved request on a collection no longer approved, reviewedAt untouched',
      collection(),
      curation({ status: 'approved' }),
      CurationState.DISABLED
    ]
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
  it('locks the assignee once the collection is published', () => {
    expect(canEditAssignee(collection({ isApproved: true }), curation({ status: 'approved' }))).toBe(false)
    // Approved before review requests existed: assigning would put it back under review.
    expect(canEditAssignee(collection({ isApproved: true }), null)).toBe(false)
    expect(canEditAssignee(collection({ isApproved: true }), curation())).toBe(true)
    expect(canEditAssignee(collection(), curation({ status: 'approved' }))).toBe(true)
  })

  it('locks it on a disabled collection with no request, which Enable turns back on without opening one', () => {
    expect(canEditAssignee(collection(reviewedBefore), null)).toBe(false)
    expect(canEditAssignee(collection(), null)).toBe(true)
  })
})

describe('curation filters', () => {
  const ME = '0xME'

  it('opens on to review and under review, unassigned and the signed-in curator, by latest activity', () => {
    expect(parseCurationFilters(new URLSearchParams('status=bogus&sort=nope&page=-3'), ME)).toEqual({
      page: 1,
      search: '',
      statuses: [CurationStatusFilter.TO_REVIEW, CurationStatusFilter.UNDER_REVIEW],
      assignees: [UNASSIGNED, '0xme'],
      reviewType: null,
      sort: CollectionSort.LAST_ACTIVITY_DESC,
      tag: null
    })
  })

  it('reads several statuses and assignees, and the review type', () => {
    const filters = parseCurationFilters(
      new URLSearchParams(
        'status=approved&status=rejected&status=nope&assignee=0xABC&assignee=unassigned&review_type=new'
      ),
      ME
    )
    expect(filters.statuses).toEqual([CurationStatusFilter.APPROVED, CurationStatusFilter.REJECTED])
    expect(filters.assignees).toEqual(['0xabc', UNASSIGNED])
    expect(filters.reviewType).toBe(ReviewType.NEW)
  })

  it('takes "all" as a cleared filter rather than the defaults', () => {
    const filters = parseCurationFilters(new URLSearchParams('status=all&assignee=all'), ME)
    expect(filters.statuses).toEqual([])
    expect(filters.assignees).toEqual([])
  })

  it('writes a picked set to the URL, "all" for none and nothing for the defaults', () => {
    const defaults = [CurationStatusFilter.TO_REVIEW, CurationStatusFilter.UNDER_REVIEW]
    expect(toMultiParam([CurationStatusFilter.UNDER_REVIEW, CurationStatusFilter.TO_REVIEW], defaults)).toBeNull()
    expect(toMultiParam([], defaults)).toEqual(['all'])
    expect(toMultiParam([CurationStatusFilter.REJECTED], defaults)).toEqual([CurationStatusFilter.REJECTED])
  })

  it('builds the committee list query for published standard collections', () => {
    const filters = parseCurationFilters(
      new URLSearchParams(
        'status=under_review&status=to_review&assignee=0xABC&assignee=unassigned&review_type=updates&q=hat&sort=NAME_ASC&page=2&tag=Summer'
      ),
      ME
    )
    const query = new URLSearchParams(toCurationQueryString(filters))
    expect(query.getAll('status')).toEqual(['under_review', 'to_review'])
    expect(query.getAll('assignee')).toEqual(['0xabc', 'unassigned'])
    expect(Object.fromEntries(query)).toMatchObject({
      is_published: 'true',
      review_type: 'updates',
      type: 'standard',
      sort: 'NAME_ASC',
      q: 'hat',
      tag: 'summer',
      page: '2',
      limit: '12'
    })
  })

  it('leaves cleared filters out of the query', () => {
    const query = new URLSearchParams(
      toCurationQueryString(parseCurationFilters(new URLSearchParams('status=all&assignee=all'), ME))
    )
    expect(query.has('status')).toBe(false)
    expect(query.has('assignee')).toBe(false)
    expect(query.has('review_type')).toBe(false)
    expect(query.has('tag')).toBe(false)
  })
})

describe('getReviewType', () => {
  it('reads a collection approved on chain, or disabled after an approval, as updates', () => {
    expect(getReviewType(collection({ isApproved: true }))).toBe(ReviewType.UPDATES)
    expect(getReviewType(collection({ isApproved: false, createdAt: 1, reviewedAt: 2 }))).toBe(ReviewType.UPDATES)
  })

  it('reads a collection never approved as new', () => {
    expect(getReviewType(collection({ isApproved: false, createdAt: 1, reviewedAt: 1 }))).toBe(ReviewType.NEW)
  })
})

describe('orderCurators', () => {
  it('puts the signed-in curator first', () => {
    expect(orderCurators(['0xa', '0xB', '0xc'], '0xb')).toEqual(['0xb', '0xa', '0xc'])
    expect(orderCurators(['0xa'], '0xz')).toEqual(['0xa'])
  })
})

describe('canPushChanges', () => {
  const approved = collection({ isApproved: true })

  it('lets managers send unsynced changes of an approved collection', () => {
    expect(canPushChanges(approved, null, true, true)).toBe(true)
    expect(canPushChanges(approved, curation({ status: 'rejected' }), true, true)).toBe(true)
  })

  it('refuses while a request is pending, without changes or without rights', () => {
    expect(canPushChanges(approved, curation(), true, true)).toBe(false)
    expect(canPushChanges(approved, null, false, true)).toBe(false)
    expect(canPushChanges(approved, null, true, false)).toBe(false)
  })

  it('lets managers ask for the first review again after a rejection, and only then', () => {
    expect(canPushChanges(collection(), curation({ status: 'rejected' }), false, true)).toBe(true)
    expect(canPushChanges(collection(), curation({ status: 'rejected' }), false, false)).toBe(false)
    expect(canPushChanges(collection(), null, true, true)).toBe(false)
    expect(canPushChanges(collection(), curation(), true, true)).toBe(false)
    expect(canPushChanges(collection({ isPublished: false }), curation({ status: 'rejected' }), true, true)).toBe(false)
  })
})

describe('curationListUrl', () => {
  it('returns to the list with the filters it was left with', () => {
    sessionStorage.clear()
    expect(curationListUrl()).toBe('/curation')
    rememberCurationSearch('?status=approved&page=2')
    expect(curationListUrl()).toBe('/curation?status=approved&page=2')
  })
})
