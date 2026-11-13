// TEMP: hardcoded review states for UX iteration on one local collection. Delete this file before merging.
import { type CollectionEvent } from '~/lib/events'
import { type Item } from '~/lib/items'

const MOCK_COLLECTION_ID = '8c3c9f3e-09d3-4081-886b-2f8bb378575b'

type MockState = 'reviewing_modal' | 'automated_reviewing' | 'passed' | 'rejected'
type MockStage = 'automated_reviewing' | 'awaiting_curator' | 'rejected_by_validator'

const MOCK_STATE = 'rejected' as MockState

const STAGES: Record<MockState, MockStage> = {
  reviewing_modal: 'automated_reviewing',
  automated_reviewing: 'automated_reviewing',
  passed: 'awaiting_curator',
  rejected: 'rejected_by_validator'
}

// A new verdict per page load, so the issues modal announces itself on every reload.
const LOADED_AT = Date.now()

const isMocked = (collectionId: string | undefined) => collectionId === MOCK_COLLECTION_ID

/** Pretends an item was saved after the mocked rejection, so the page offers "Review again". */
const MOCK_HAS_CHANGES = true

export function mockHasChanges(collectionId: string | undefined): boolean {
  return isMocked(collectionId) && MOCK_STATE === 'rejected' && MOCK_HAS_CHANGES
}

export function getMockReviewRequest(collectionId: string | undefined): 'reviewing' | null {
  return isMocked(collectionId) && MOCK_STATE === 'reviewing_modal' ? 'reviewing' : null
}

export function getMockReviewStage(collectionId: string | undefined): MockStage | null {
  return isMocked(collectionId) ? STAGES[MOCK_STATE] : null
}

/** Puts a rejected automated review, with findings on the first item, on top of the real timeline. */
export function withMockReviewEvents(
  collectionId: string | undefined,
  events: CollectionEvent[] | null,
  items: Pick<Item, 'id' | 'currentContentHash'>[] | undefined
): CollectionEvent[] | null {
  if (!isMocked(collectionId) || MOCK_STATE !== 'rejected' || !collectionId) return events
  const failed = items?.[0]
  const base = { collectionId, actor: 'validator' as const, actorAddress: null }
  return [
    {
      ...base,
      id: `mock-verdict-${LOADED_AT}`,
      type: 'review.automated_rejected',
      createdAt: LOADED_AT,
      payload: {
        validationId: 'mock-validation',
        verdict: 'rejected',
        items: failed
          ? [
              {
                itemId: failed.id,
                contentHash: failed.currentContentHash ?? '',
                passed: false,
                findings: [
                  {
                    rule: 'M-01',
                    check: 'Triangle count',
                    severity: 'error',
                    message: 'The model has 2,340 triangles, over the limit for its category.',
                    measured: 2340,
                    limit: 1500,
                    fix: 'Reduce the mesh to 1,500 triangles or fewer.'
                  },
                  {
                    rule: 'T-03',
                    check: 'Texture size',
                    severity: 'warning',
                    message: 'A texture is larger than 1024x1024.',
                    where: 'male/texture.png',
                    fix: 'Resize it to 1024x1024 or smaller.'
                  }
                ]
              }
            ]
          : []
      }
    },
    {
      ...base,
      id: `mock-started-${LOADED_AT}`,
      type: 'review.automated_started',
      createdAt: LOADED_AT - 60_000,
      payload: { trigger: 'publish' }
    },
    ...(events ?? [])
  ]
}
