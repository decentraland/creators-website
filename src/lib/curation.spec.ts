import { describe, expect, it } from 'vitest'
import { CollectionSort, type Collection } from './collections'
import {
  CurationState,
  CurationStatusFilter,
  ReviewAction,
  canEditAssignee,
  fromRemoteCuration,
  getCurationState,
  getReviewActions,
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
