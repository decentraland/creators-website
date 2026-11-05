import { fromRemoteEvent, type CollectionEventsPage, type RemoteCollectionEvent } from '~/lib/events'
import { BuilderServerError, request } from './transport'

export const VALIDATION_RUNNING_STATUS = 409
export const VALIDATION_LIMIT_STATUS = 429

/** The daily allowance is spent: builder-server says when the next automatic review may start. */
export class ValidationLimitError extends BuilderServerError {
  retryAt: number | null

  constructor(error: BuilderServerError) {
    super(error.message, error.status, error.data)
    this.name = 'ValidationLimitError'
    this.retryAt = readRetryAt(error.data)
  }
}

function readRetryAt(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const record = data as { retryAt?: unknown; data?: { retryAt?: unknown } }
  const value = record.retryAt ?? record.data?.retryAt
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const time = +new Date(value)
  return Number.isNaN(time) ? null : time
}

/** Rethrows a 429 as the error that carries when the next automatic review may start. */
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

/** Escalates a rejection to a human curator: POST /collections/{id}/curation/appeal. 409 while an appeal is open. */
export async function appealCollectionCuration(address: string, collectionId: string, note = ''): Promise<void> {
  const body = note.trim() ? { note: note.trim() } : {}
  await request<unknown>(address, 'POST', `/collections/${collectionId}/curation/appeal`, '', body, false)
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
