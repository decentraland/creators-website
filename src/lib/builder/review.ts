import { fromRemoteEvent, type CollectionEventsPage, type RemoteCollectionEvent } from '~/lib/events'
import { BuilderServerError, request } from './transport'

const REVIEW_CONFLICT_STATUS = 409
const COLLECTION_BUSY_STATUS = 503
export const VALIDATION_LIMIT_STATUS = 429
const VALIDATION_RUNNING_MESSAGE = 'A validation is already in progress for this collection'

/** A 409 from the review endpoints (a run in progress, nothing new to validate, an open appeal): an answer, not a failure. */
export function isReviewConflict(error: unknown): boolean {
  return error instanceof BuilderServerError && error.status === REVIEW_CONFLICT_STATUS
}

/** The 409 that means an automatic review of the collection is running right now. */
export function isValidationRunning(error: unknown): boolean {
  return isReviewConflict(error) && (error as BuilderServerError).message === VALIDATION_RUNNING_MESSAGE
}

/** builder-server is busy with another update of the collection: the same action works on retry. */
export function isCollectionBusy(error: unknown): boolean {
  return error instanceof BuilderServerError && error.status === COLLECTION_BUSY_STATUS
}

/** Today's automatic reviews are spent: the creator waits for tomorrow or asks a curator. */
export class ValidationLimitError extends BuilderServerError {
  constructor(error: BuilderServerError) {
    super(error.message, error.status, error.data)
    this.name = 'ValidationLimitError'
  }
}

/** Rethrows a 429 as the daily-limit error. */
export function toValidationLimitError(error: unknown): unknown {
  return error instanceof BuilderServerError && error.status === VALIDATION_LIMIT_STATUS
    ? new ValidationLimitError(error)
    : error
}

/**
 * Asks for another automatic review: POST /collections/{id}/validations. 409 while one is running,
 * 429 (`ValidationLimitError`) once today's three are spent.
 */
export async function requestCollectionValidation(address: string, collectionId: string): Promise<void> {
  try {
    await request<unknown>(address, 'POST', `/collections/${collectionId}/validations`, '', undefined, false)
  } catch (error) {
    throw toValidationLimitError(error)
  }
}

const APPEAL_ALREADY_OPEN_MESSAGE = 'There is already an open appeal for this collection'

/** The appeal's 409 when one is already open; the other 409 means the latest request is not a rejection. */
export function isAppealAlreadyOpen(error: unknown): boolean {
  return error instanceof BuilderServerError && error.message === APPEAL_ALREADY_OPEN_MESSAGE
}

/**
 * Escalates a rejection to a human curator: POST /collections/{id}/curation/appeal. 409 while an appeal is
 * open (`isAppealAlreadyOpen`) or when the latest request is not rejected.
 */
export async function appealCollectionCuration(address: string, collectionId: string): Promise<void> {
  await request<unknown>(address, 'POST', `/collections/${collectionId}/curation/appeal`, '', {}, false)
}

/**
 * The collection's timeline, newest first: GET /collections/{id}/events. The server offsets by
 * `limit * (page - 1)`, so callers page with one constant `limit`.
 */
export async function fetchCollectionEvents(
  address: string,
  collectionId: string,
  { page, limit }: { page: number; limit: number }
): Promise<CollectionEventsPage> {
  const remote = await request<{ results: RemoteCollectionEvent[]; total: number; page: number; limit: number }>(
    address,
    'GET',
    `/collections/${collectionId}/events`,
    `?page=${page}&limit=${limit}`
  )
  return { ...remote, results: remote.results.map(fromRemoteEvent) }
}
