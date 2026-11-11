import { afterEach, describe, expect, it, vi } from 'vitest'
import { markReviewModalSeen, wasReviewModalSeen } from './reviewModalMemory'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('review modal memory', () => {
  it('remembers the verdict modal a creator saw, per collection', () => {
    markReviewModalSeen('c1', 'verdict:e1')

    expect(wasReviewModalSeen('c1', 'verdict:e1')).toBe(true)
    expect(wasReviewModalSeen('c2', 'verdict:e1')).toBe(false)
  })

  it('shows the next verdict again', () => {
    markReviewModalSeen('c1', 'verdict:e1')

    expect(wasReviewModalSeen('c1', 'verdict:e2')).toBe(false)
  })

  it('keeps working when the browser refuses to store it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => markReviewModalSeen('c1', 'verdict:e1')).not.toThrow()
    // Remembered for the rest of the visit, so closing it does not reopen it.
    expect(wasReviewModalSeen('c1', 'verdict:e1')).toBe(true)
  })

  it('keeps a closed modal closed when the browser blocks storage altogether', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })

    markReviewModalSeen('c9', 'handoff:e1')

    expect(wasReviewModalSeen('c9', 'handoff:e1')).toBe(true)
    expect(wasReviewModalSeen('c9', 'handoff:e2')).toBe(false)
  })
})
