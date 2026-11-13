// TEMP: hardcoded review states for UX iteration on one local collection. Delete this file before merging.
const MOCK_COLLECTION_ID = '8c3c9f3e-09d3-4081-886b-2f8bb378575b'

type MockState = 'reviewing_modal' | 'automated_reviewing' | 'passed'

const MOCK_STATE = 'passed' as MockState

const isMocked = (collectionId: string | undefined) => collectionId === MOCK_COLLECTION_ID

export function getMockReviewRequest(collectionId: string | undefined): 'reviewing' | null {
  return isMocked(collectionId) && MOCK_STATE === 'reviewing_modal' ? 'reviewing' : null
}

export function getMockReviewStage(
  collectionId: string | undefined
): 'automated_reviewing' | 'awaiting_curator' | null {
  if (!isMocked(collectionId)) return null
  return MOCK_STATE === 'passed' ? 'awaiting_curator' : 'automated_reviewing'
}
