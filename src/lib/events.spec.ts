import { describe, expect, it } from 'vitest'
import {
  countValidationAttempts,
  fromRemoteEvent,
  getFailedItems,
  getLatestVerdict,
  getValidationAttemptsLeft,
  hasOpenAppeal,
  isValidationInProgress,
  isValidationRunning,
  startOfUtcDay,
  type CollectionEvent
} from './events'

const NOW = Date.UTC(2026, 8, 29, 15, 0, 0)
const TODAY = Date.UTC(2026, 8, 29, 0, 0, 0)

let counter = 0
function event(type: string, createdAt: number, payload: CollectionEvent['payload'] = {}): CollectionEvent {
  return { id: `e${++counter}`, collectionId: 'c1', type, actor: 'validator', actorAddress: null, payload, createdAt }
}

describe('fromRemoteEvent', () => {
  it('maps the row, lowercases the actor and defaults an empty payload', () => {
    expect(
      fromRemoteEvent({
        id: 'e1',
        collection_id: 'c1',
        type: 'review.approved',
        actor: 'curator',
        actor_address: '0xABC',
        payload: null,
        created_at: '2026-09-29T10:00:00Z'
      })
    ).toEqual({
      id: 'e1',
      collectionId: 'c1',
      type: 'review.approved',
      actor: 'curator',
      actorAddress: '0xabc',
      payload: {},
      createdAt: Date.parse('2026-09-29T10:00:00Z')
    })
  })
})

describe('countValidationAttempts', () => {
  it('counts only verdicts, never starts or errors', () => {
    const events = [
      event('review.ai_started', NOW),
      event('review.ai_rejected', NOW - 1000),
      event('review.ai_error', NOW - 2000),
      event('review.ai_started', NOW - 3000),
      event('review.ai_passed', NOW - 4000)
    ]
    expect(countValidationAttempts(events, NOW)).toBe(2)
    expect(getValidationAttemptsLeft(events, NOW)).toBe(1)
  })

  it('resets at 00:00 UTC', () => {
    const events = [event('review.ai_rejected', TODAY + 1), event('review.ai_rejected', TODAY - 1)]
    expect(startOfUtcDay(NOW)).toBe(TODAY)
    expect(countValidationAttempts(events, NOW)).toBe(1)
  })

  it('resets after a curator decision', () => {
    const events = [
      event('review.ai_rejected', NOW - 1000),
      event('review.approved', NOW - 2000),
      event('review.ai_rejected', NOW - 3000),
      event('review.ai_rejected', NOW - 4000)
    ]
    expect(countValidationAttempts(events, NOW)).toBe(1)
  })

  it('clamps the attempts left at zero', () => {
    const events = Array.from({ length: 4 }, (_, i) => event('review.ai_rejected', NOW - i))
    expect(getValidationAttemptsLeft(events, NOW)).toBe(0)
  })
})

describe('getLatestVerdict', () => {
  it('answers the newest verdict with its items, and null without one', () => {
    const items = [{ itemId: 'i1', contentHash: 'h', passed: false, findings: [] }]
    const events = [
      event('review.appeal_requested', NOW),
      event('review.ai_rejected', NOW - 1000, { verdict: 'rejected', items }),
      event('review.ai_passed', NOW - 2000, { verdict: 'passed', items: [] })
    ]
    const verdict = getLatestVerdict(events)
    expect(verdict?.payload.verdict).toBe('rejected')
    expect(getFailedItems(verdict!.payload)).toEqual(items)
    expect(getLatestVerdict([event('review.ai_started', NOW)])).toBeNull()
  })

  it('fills in the verdict from the event type when the payload lacks it', () => {
    expect(getLatestVerdict([event('review.ai_passed', NOW, { items: [] })])?.payload.verdict).toBe('passed')
  })
})

describe('latest-event flags', () => {
  it('knows when a validation is running and when an appeal is open', () => {
    expect(isValidationRunning([event('review.ai_started', NOW)])).toBe(true)
    expect(isValidationRunning([event('review.ai_rejected', NOW)])).toBe(false)
    expect(hasOpenAppeal([event('review.appeal_requested', NOW)])).toBe(true)
    expect(hasOpenAppeal([])).toBe(false)
  })

  it('keeps a verdict pending through a validator error and an assignment, until it lands', () => {
    expect(isValidationInProgress([event('review.assigned', NOW), event('review.ai_error', NOW - 1)])).toBe(true)
    expect(isValidationInProgress([event('review.ai_started', NOW)])).toBe(true)
    expect(isValidationInProgress([event('review.ai_rejected', NOW), event('review.ai_started', NOW - 1)])).toBe(false)
  })
})
