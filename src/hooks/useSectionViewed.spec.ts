import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { track } from '~/lib/analytics'
import { OverviewSection } from '~/lib/overviewAnalytics'
import { useSectionViewed } from './useSectionViewed'

vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('~/hooks/useMediaQuery', () => ({ useMediaQuery: () => viewport.mobile }))

beforeEach(() => {
  vi.mocked(track).mockClear()
  viewport.mobile = false
})

describe('useSectionViewed', () => {
  it('reports the section once, the first time it comes into view', () => {
    const { rerender } = renderHook(({ inView }) => useSectionViewed(OverviewSection.WHY, inView), {
      initialProps: { inView: false }
    })
    expect(track).not.toHaveBeenCalled()

    rerender({ inView: true })
    rerender({ inView: true })
    rerender({ inView: false })
    rerender({ inView: true })

    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('Section Viewed', { section_viewed: 'Creators Why', mobile: false })
  })

  it('flags mobile viewports', () => {
    viewport.mobile = true
    renderHook(() => useSectionViewed(OverviewSection.FAQS, true))
    expect(track).toHaveBeenCalledWith('Section Viewed', { section_viewed: 'Creators Faqs', mobile: true })
  })
})
