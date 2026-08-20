import { describe, it, expect } from 'vitest'
import { formatTimeAgo } from './time'

const NOW = +new Date('2026-08-20T12:00:00Z')

describe('formatTimeAgo', () => {
  it('picks the largest whole unit', () => {
    expect(formatTimeAgo(NOW - 21 * 24 * 3_600_000, 'en', NOW)).toBe('3 weeks ago')
    expect(formatTimeAgo(NOW - 2 * 24 * 3_600_000, 'en', NOW)).toBe('2 days ago')
    expect(formatTimeAgo(NOW - 5 * 3_600_000, 'en', NOW)).toBe('5 hours ago')
    expect(formatTimeAgo(NOW - 400 * 24 * 3_600_000, 'en', NOW)).toBe('1 year ago')
  })

  it('clamps anything under a minute to 1 minute ago', () => {
    expect(formatTimeAgo(NOW - 10_000, 'en', NOW)).toBe('1 minute ago')
    expect(formatTimeAgo(NOW, 'en', NOW)).toBe('1 minute ago')
  })

  it('localizes', () => {
    expect(formatTimeAgo(NOW - 21 * 24 * 3_600_000, 'es', NOW)).toBe('hace 3 semanas')
  })
})
