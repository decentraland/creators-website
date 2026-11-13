import { type ReviewFlowRequest } from './ReviewFlow'

// TEMP: hardcoded review states for UX iteration on one local collection. Delete this file before merging.
const MOCK_COLLECTION_ID = '8c3c9f3e-09d3-4081-886b-2f8bb378575b'

const MOCK_REQUEST: ReviewFlowRequest | null = 'reviewing'

export function getMockReviewRequest(collectionId: string | undefined): ReviewFlowRequest | null {
  return collectionId === MOCK_COLLECTION_ID ? MOCK_REQUEST : null
}
