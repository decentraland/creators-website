// Collection timeline: the append-only events builder-server writes during publication and review
// (`GET /collections/:id/events`). The review stage, the validator's verdict and the daily retry
// allowance are all read off these rows; nothing here is stored on the client.

export const COLLECTION_EVENT_TYPES = [
  'collection.published',
  'review.human_required',
  'review.ai_started',
  'review.ai_passed',
  'review.ai_rejected',
  'review.ai_error',
  'review.appeal_requested',
  'review.assigned',
  'review.approved',
  'review.rejected',
  'changes.submitted',
  'collection.disabled'
] as const
export type CollectionEventType = (typeof COLLECTION_EVENT_TYPES)[number]

export type CollectionEventActor = 'creator' | 'curator' | 'validator' | 'system'

export const REJECT_REASON_CODES = [
  'clipping',
  'thumbnail',
  'category_hides',
  'rigging',
  'triangle_count',
  'emote',
  'file_size',
  'textures_materials',
  'reversed_faces',
  'smart_wearable_files',
  'content_policy_ip',
  'other'
] as const
export type RejectReasonCode = (typeof REJECT_REASON_CODES)[number]

export type FindingSeverity = 'error' | 'warning'

export type BodyShape = 'male' | 'female'

/** One validator finding, as the validation job reports it back. */
export type ValidationFinding = {
  /** Rule-book id, e.g. M-01. */
  rule: string
  check?: string
  severity: FindingSeverity
  message: string
  where?: string
  bodyShape?: BodyShape
  measured?: number
  limit?: number
  fix?: string
  docs?: string
}

export type ValidationItemResult = {
  itemId: string
  contentHash: string
  /** `null` when the item could not be validated; never a pass. */
  passed: boolean | null
  findings: ValidationFinding[]
  visualSummary?: string
  /** Undecided because the validator cannot judge this kind of item, not because something failed. */
  unsupported?: boolean
  /** Why the item could not be validated. */
  error?: string
}

export type ValidationVerdict = 'passed' | 'rejected' | 'error'

/**
 * Payload of `review.ai_passed` / `review.ai_rejected` / `review.ai_error`: the validator's whole result.
 * `validationId` only reaches the committee; `collectionId` and `rulesVersion` are missing on older rows.
 */
export type ValidationVerdictPayload = {
  validationId?: string
  collectionId?: string
  verdict: ValidationVerdict
  reason?: 'unsupported'
  retryable?: boolean
  rulesVersion?: string
  items: ValidationItemResult[]
}

export type CurationDecisionPayload = {
  rejectionReasons?: RejectReasonCode[]
  rejectionMessage?: string
}

export type HumanRequiredReason = 'third_party' | 'unsupported_items' | 'validator_error'

/** `review.ai_error` reasons the server never resends: only a curator or a new request moves the review on. */
export type FinalAiErrorReason = 'sweep_exhausted' | 'too_large'

export type CollectionEventPayload = Omit<Partial<ValidationVerdictPayload>, 'reason'> &
  CurationDecisionPayload & {
    /** `HumanRequiredReason` on `review.human_required`, `FinalAiErrorReason` on `review.ai_error`; open for newer ones. */
    reason?: string
    trigger?: string
    itemIds?: string[]
    note?: string
    assignee?: string | null
  }

export type RemoteCollectionEvent = {
  id: string
  collection_id: string
  type: string
  actor: CollectionEventActor
  actor_address?: string | null
  payload?: CollectionEventPayload | null
  created_at: string
}

export type CollectionEvent = {
  id: string
  collectionId: string
  /** One of `COLLECTION_EVENT_TYPES`; kept open so a newer server type renders as an unknown row, not a crash. */
  type: string
  actor: CollectionEventActor
  actorAddress: string | null
  payload: CollectionEventPayload
  createdAt: number
}

export type CollectionEventsPage = {
  results: CollectionEvent[]
  total: number
  page: number
  limit: number
}

export function fromRemoteEvent(remote: RemoteCollectionEvent): CollectionEvent {
  return {
    id: remote.id,
    collectionId: remote.collection_id,
    type: remote.type,
    actor: remote.actor,
    actorAddress: remote.actor_address ? remote.actor_address.toLowerCase() : null,
    payload: remote.payload ?? {},
    createdAt: +new Date(remote.created_at)
  }
}

const VERDICT_TYPES = new Set(['review.ai_passed', 'review.ai_rejected'])
const HUMAN_DECISION_TYPES = new Set(['review.approved', 'review.rejected'])

export const VALIDATION_ATTEMPTS_PER_DAY = 3

/** The newest verdict the validator produced, if any. `events` newest first, as the server lists them. */
export function getLatestVerdict(
  events: CollectionEvent[]
): (CollectionEvent & { payload: ValidationVerdictPayload }) | null {
  const event = events.find(candidate => VERDICT_TYPES.has(candidate.type))
  if (!event || !Array.isArray(event.payload.items)) return null
  return {
    ...event,
    payload: {
      validationId: event.payload.validationId,
      verdict: event.payload.verdict ?? (event.type === 'review.ai_passed' ? 'passed' : 'rejected'),
      rulesVersion: event.payload.rulesVersion,
      items: event.payload.items
    }
  }
}

export function startOfUtcDay(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * Automatic reviews used today: verdicts newer than the later of today 00:00 UTC and the newest curator
 * decision. The server counts the same way, so the button and the 429 agree. `events` newest first.
 */
export function countValidationAttempts(events: CollectionEvent[], now = Date.now()): number {
  const dayStart = startOfUtcDay(now)
  let attempts = 0
  for (const event of events) {
    if (event.createdAt < dayStart || HUMAN_DECISION_TYPES.has(event.type)) break
    if (VERDICT_TYPES.has(event.type)) attempts++
  }
  return attempts
}

export function getValidationAttemptsLeft(events: CollectionEvent[], now = Date.now()): number {
  return Math.max(0, VALIDATION_ATTEMPTS_PER_DAY - countValidationAttempts(events, now))
}

/** A retry is refused (409) while the validator is still working on the latest request. */
export function isValidationRunning(events: CollectionEvent[]): boolean {
  return events[0]?.type === 'review.ai_started'
}

/** Events that say nothing about the review stage: an assignment or a submitted change leaves it where it was. */
export const STAGE_NEUTRAL_EVENT_TYPES = new Set(['review.assigned', 'changes.submitted'])

export function latestStageEvent(events: CollectionEvent[]): CollectionEvent | undefined {
  return events.find(event => !STAGE_NEUTRAL_EVENT_TYPES.has(event.type))
}

/** `review.human_required` written because the validator cannot check some items (e.g. facial-feature PNGs). */
export const UNSUPPORTED_ITEMS_REASON = 'unsupported_items'

export function isUnsupportedItemsReview(event: CollectionEvent | undefined): boolean {
  return event?.type === 'review.human_required' && event.payload.reason === UNSUPPORTED_ITEMS_REASON
}

export const VALIDATOR_ERROR_REASON = 'validator_error'
export const SWEEP_EXHAUSTED_REASON = 'sweep_exhausted'
const FINAL_AI_ERROR_REASONS: readonly string[] = [SWEEP_EXHAUSTED_REASON, 'too_large'] satisfies FinalAiErrorReason[]

/** The validator gave up on the latest request: no verdict will come without a curator or a new request. */
export function isFinalValidationError(event: CollectionEvent | undefined): boolean {
  if (event?.type === 'review.ai_error') return FINAL_AI_ERROR_REASONS.includes(event.payload.reason ?? '')
  return event?.type === 'review.human_required' && event.payload.reason === VALIDATOR_ERROR_REASON
}

/** A verdict is still to come: the validator is working, or failed and the server's sweep will resend. */
export function isValidationInProgress(events: CollectionEvent[]): boolean {
  const latest = latestStageEvent(events)
  return latest?.type === 'review.ai_started' || (latest?.type === 'review.ai_error' && !isFinalValidationError(latest))
}

/** The appeal endpoint answers 409 while the latest event is still the open appeal. */
export function hasOpenAppeal(events: CollectionEvent[]): boolean {
  return events[0]?.type === 'review.appeal_requested'
}

/** The items the validator did not pass, in payload order; `null` (not checked) is listed too, never as a pass. */
export function getFailedItems(payload: ValidationVerdictPayload): ValidationItemResult[] {
  return payload.items.filter(item => item.passed !== true)
}

/** Items the validator explicitly failed; an unchecked (`null`) item is not counted as one. */
export function countFailedItems(items: ValidationItemResult[]): number {
  return items.filter(item => item.passed === false).length
}

const BODY_SHAPE_FOLDER = /^("?)(male|female)\//i

/**
 * One row per finding, with the body shapes it was found on: the same finding on both shapes' files differs only
 * in `bodyShape` and the shape's folder in `where`. Order follows each row's first occurrence.
 */
export function mergeBodyShapeFindings<F extends { bodyShape?: BodyShape; where?: string }>(
  findings: F[]
): (Omit<F, 'bodyShape'> & { bodyShapes: BodyShape[] })[] {
  const rows = new Map<string, Omit<F, 'bodyShape'> & { bodyShapes: BodyShape[] }>()
  for (const { bodyShape, ...rest } of findings) {
    const where = bodyShape ? rest.where?.replace(BODY_SHAPE_FOLDER, '$1') : rest.where
    const shown = { ...rest, where }
    const key = JSON.stringify(shown)
    const row = rows.get(key)
    if (!row) rows.set(key, { ...shown, bodyShapes: bodyShape ? [bodyShape] : [] })
    else if (bodyShape && !row.bodyShapes.includes(bodyShape)) row.bodyShapes.push(bodyShape)
  }
  return [...rows.values()]
}

export function isRejectReasonCode(code: unknown): code is RejectReasonCode {
  return typeof code === 'string' && (REJECT_REASON_CODES as readonly string[]).includes(code)
}

export const VALIDATION_TRIGGERS = ['publish', 'retry', 'changes', 'sweep'] as const
export type ValidationTrigger = (typeof VALIDATION_TRIGGERS)[number]

export function isValidationTrigger(value: unknown): value is ValidationTrigger {
  return typeof value === 'string' && (VALIDATION_TRIGGERS as readonly string[]).includes(value)
}
