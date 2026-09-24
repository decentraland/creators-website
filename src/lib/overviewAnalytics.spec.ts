import { describe, expect, it, vi, beforeEach } from 'vitest'
import { track } from '~/lib/analytics'
import { OverviewSection, clickPayload, trackClick, trackSectionViewed } from './overviewAnalytics'

vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))

beforeEach(() => vi.mocked(track).mockClear())

describe('trackSectionViewed', () => {
  it('sends the section under the name the sites landing used', () => {
    trackSectionViewed(OverviewSection.WHY, true)
    expect(track).toHaveBeenCalledWith('Section Viewed', { section_viewed: 'Creators Why', mobile: true })
  })
})

describe('clickPayload', () => {
  it('reads the place, title, card and tab dimensions off the element', () => {
    const element = document.createElement('a')
    element.setAttribute('data-place', 'Creators Create')
    element.setAttribute('data-title', 'Creating Wearables')
    element.setAttribute('data-card', 'wearables')
    element.setAttribute('data-tab', 'regular')
    element.setAttribute('href', 'https://example.com')
    expect(clickPayload(element)).toEqual({
      place: 'Creators Create',
      title: 'Creating Wearables',
      card: 'wearables',
      tab: 'regular'
    })
  })

  it('skips empty values and the data attributes styled primitives stamp for themselves', () => {
    const element = document.createElement('button')
    element.setAttribute('data-place', 'Creators Faqs')
    element.setAttribute('data-title', '')
    element.setAttribute('data-testid', 'faq-row')
    element.setAttribute('data-variant', 'primary')
    expect(clickPayload(element)).toEqual({ place: 'Creators Faqs' })
  })
})

describe('trackClick', () => {
  it('reports a Click with the clicked element as the payload source', () => {
    const element = document.createElement('a')
    element.setAttribute('data-place', 'Creators Why')
    element.setAttribute('data-title', 'Join the Discord')
    trackClick({ currentTarget: element } as unknown as React.SyntheticEvent<Element>)
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Why', title: 'Join the Discord' })
  })
})
