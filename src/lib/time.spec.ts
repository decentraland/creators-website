import { describe, it, expect } from 'vitest'
import { formatLongDate, formatTimeAgo, formatTimeUntil } from './time'

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

describe('formatLongDate', () => {
  it('spells the date out in the given locale', () => {
    expect(formatLongDate('2026-02-11T12:00:00Z', 'en')).toBe('February 11, 2026')
    expect(formatLongDate('2026-02-11T12:00:00Z', 'es')).toBe('11 de febrero de 2026')
  })

  it('keeps a date-only value on its calendar day whatever the local zone', () => {
    expect(formatLongDate('2026-02-11', 'en')).toBe('February 11, 2026')
  })

  it('is empty for a missing or unparsable date', () => {
    expect(formatLongDate(null, 'en')).toBe('')
    expect(formatLongDate('not a date', 'en')).toBe('')
  })
})

describe('formatTimeUntil', () => {
  const now = Date.UTC(2026, 8, 29, 12, 0, 0)

  it('counts forward in the largest unit and clamps under a minute', () => {
    expect(formatTimeUntil(now + 3 * 3_600_000, 'en', now)).toBe('in 3 hours')
    expect(formatTimeUntil(now + 150_000, 'en', now)).toBe('in 3 minutes')
    expect(formatTimeUntil(now + 10_000, 'en', now)).toBe('in 1 minute')
    expect(formatTimeUntil(now + 2 * 24 * 3_600_000, 'es', now)).toBe('dentro de 2 días')
  })

  it('reads a past timestamp as time ago', () => {
    expect(formatTimeUntil(now - 3_600_000, 'en', now)).toBe('1 hour ago')
  })
})
