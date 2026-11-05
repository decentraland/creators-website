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
    expect(wasReviewModalSeen('c1', 'verdict:e1')).toBe(false)
  })
})
