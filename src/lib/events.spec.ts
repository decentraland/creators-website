import { describe, expect, it } from 'vitest'
import { BodyShape } from '@dcl/schemas'
import { ValidationSeverity } from '~/lib/validation'
import {
  countValidationAttempts,
  fromRemoteEvent,
  getAiIssuesByItem,
  getFailedItems,
  getLatestVerdict,
  getValidationAttemptsLeft,
  hasOpenAppeal,
  isFinalValidationError,
  isValidationInProgress,
  isValidationRunning,
  mergeBodyShapeFindings,
  startOfUtcDay,
  type CollectionEvent,
  type ValidationFinding
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
  it('counts the runs the creator caused, never the sweep re-sends nor the verdicts', () => {
    const events = [
      event('review.ai_started', NOW, { trigger: 'sweep' }),
      event('review.ai_rejected', NOW - 1000),
      event('review.ai_started', NOW - 2000, { trigger: 'retry' }),
      event('review.ai_error', NOW - 3000),
      event('review.ai_started', NOW - 4000, { trigger: 'changes' }),
      event('review.ai_passed', NOW - 5000),
      event('review.ai_started', NOW - 6000, { trigger: 'publish' })
    ]
    expect(countValidationAttempts(events, NOW)).toBe(3)
    expect(getValidationAttemptsLeft(events, NOW)).toBe(0)
  })

  it('reads one review used right after publishing', () => {
    const events = [event('review.ai_started', NOW, { trigger: 'publish' }), event('collection.published', NOW - 1)]
    expect(countValidationAttempts(events, NOW)).toBe(1)
    expect(getValidationAttemptsLeft(events, NOW)).toBe(2)
  })

  it('resets at 00:00 UTC', () => {
    const events = [
      event('review.ai_started', TODAY + 1, { trigger: 'retry' }),
      event('review.ai_started', TODAY - 1, { trigger: 'retry' })
    ]
    expect(startOfUtcDay(NOW)).toBe(TODAY)
    expect(countValidationAttempts(events, NOW)).toBe(1)
  })

  it('resets after a curator decision', () => {
    const events = [
      event('review.ai_started', NOW - 1000, { trigger: 'retry' }),
      event('review.approved', NOW - 2000),
      event('review.ai_started', NOW - 3000, { trigger: 'retry' }),
      event('review.ai_started', NOW - 4000, { trigger: 'publish' })
    ]
    expect(countValidationAttempts(events, NOW)).toBe(1)
  })

  it('clamps the attempts left at zero', () => {
    const events = Array.from({ length: 4 }, (_, i) => event('review.ai_started', NOW - i, { trigger: 'retry' }))
    expect(getValidationAttemptsLeft(events, NOW)).toBe(0)
  })
})

describe('getAiIssuesByItem', () => {
  const finding: ValidationFinding = {
    rule: 'M-01',
    check: 'Triangle count',
    severity: 'error',
    message: 'Too many triangles.',
    fix: 'Decimate the mesh.',
    bodyShape: 'male',
    where: 'male/hat.glb'
  }

  it("dresses the newest rejection's findings per failed item like the browser's checks", () => {
    const events = [
      event('review.ai_rejected', NOW, {
        verdict: 'rejected',
        items: [
          { itemId: 'i1', contentHash: 'h', passed: false, findings: [finding] },
          { itemId: 'i2', contentHash: 'h', passed: true, findings: [] },
          { itemId: 'i3', contentHash: 'h', passed: null, findings: [], unsupported: true }
        ]
      })
    ]
    const issues = getAiIssuesByItem(events)
    expect([...issues.keys()]).toEqual(['i1'])
    expect(issues.get('i1')).toEqual([
      {
        code: 'M-01',
        severity: ValidationSeverity.ERROR,
        message: 'Too many triangles. Decimate the mesh.',
        title: 'Triangle count',
        where: 'male/hat.glb',
        bodyShapes: [BodyShape.MALE],
        source: 'ai'
      }
    ])
  })

  it('shows nothing after a pass, without a verdict, or for items edited while the validator ran', () => {
    const rejected = { itemId: 'i1', contentHash: 'h', passed: false, findings: [finding] }
    expect(getAiIssuesByItem([event('review.ai_passed', NOW, { verdict: 'passed', items: [] })]).size).toBe(0)
    expect(getAiIssuesByItem([event('review.ai_started', NOW)]).size).toBe(0)
    expect(
      getAiIssuesByItem([
        event('review.ai_rejected', NOW, { verdict: 'rejected', items: [rejected], staleItemIds: ['i1'] })
      ]).size
    ).toBe(0)
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

  it('stops waiting once the server gave up on the request', () => {
    for (const reason of ['sweep_exhausted', 'too_large']) {
      const gaveUp = event('review.ai_error', NOW, { reason, validationId: 'v1' })
      expect(isFinalValidationError(gaveUp)).toBe(true)
      expect(isValidationInProgress([event('review.assigned', NOW), gaveUp])).toBe(false)
    }
    const validatorError = event('review.human_required', NOW, { reason: 'validator_error' })
    expect(isFinalValidationError(validatorError)).toBe(true)
    expect(isFinalValidationError(event('review.human_required', NOW, { reason: 'third_party' }))).toBe(false)
    expect(isFinalValidationError(event('review.ai_error', NOW, { verdict: 'error', retryable: true }))).toBe(false)
  })
})

describe('mergeBodyShapeFindings', () => {
  const finding = { rule: 'M-01', check: 'triangles', severity: 'error' as const, message: 'Too many triangles' }

  it('merges the same finding on both body shapes into one row', () => {
    expect(
      mergeBodyShapeFindings<ValidationFinding>([
        { ...finding, where: 'male/hat.glb', bodyShape: 'male', measured: 1940, limit: 1500 },
        { ...finding, where: 'female/hat.glb', bodyShape: 'female', measured: 1940, limit: 1500 },
        { rule: 'S-05', severity: 'warning', message: 'Large file' }
      ])
    ).toEqual([
      { ...finding, where: 'hat.glb', measured: 1940, limit: 1500, bodyShapes: ['male', 'female'] },
      { rule: 'S-05', severity: 'warning', message: 'Large file', where: undefined, bodyShapes: [] }
    ])
  })

  it('keeps findings apart when their measures differ', () => {
    const rows = mergeBodyShapeFindings<ValidationFinding>([
      { ...finding, where: '"male/hat.glb" › Albedo', bodyShape: 'male', measured: 1940 },
      { ...finding, where: '"female/hat.glb" › Albedo', bodyShape: 'female', measured: 2100 }
    ])
    expect(rows.map(row => [row.where, row.bodyShapes])).toEqual([
      ['"hat.glb" › Albedo', ['male']],
      ['"hat.glb" › Albedo', ['female']]
    ])
  })
})
