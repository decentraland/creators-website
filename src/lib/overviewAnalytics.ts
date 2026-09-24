// Overview page analytics (spec: design/TRACKING_SPEC.md "Overview"). The page moved here from the
// sites repo, so the event names and payload shapes are kept verbatim for warehouse continuity.
import type { SyntheticEvent } from 'react'
import { track } from '~/lib/analytics'

/** `section_viewed` values, one per section of the overview page. */
export const OverviewSection = {
  HERO: 'Creators Hero',
  WHY: 'Creators Why',
  CREATE: 'Creators Create',
  LIVE_SCENES: 'Creators Live Scenes',
  CONNECT: 'Creators Connect',
  LEARN: 'Creators Learn',
  BLOG: 'Creators Blog',
  FAQS: 'Creators Faqs'
} as const

export type OverviewSection = (typeof OverviewSection)[keyof typeof OverviewSection]

export const SECTION_VIEWED_EVENT = 'Section Viewed'
export const CLICK_EVENT = 'Click'

/** Fired once per section per page load, the first time it scrolls into view. */
export function trackSectionViewed(section: OverviewSection, mobile: boolean): void {
  track(SECTION_VIEWED_EVENT, { section_viewed: section, mobile })
}

// The warehouse dimensions of a click, read from the element that describes itself through them. A
// whitelist: styled primitives stamp their own `data-*` (variant, size, testid) that must not leak.
const CLICK_DIMENSIONS = ['place', 'title', 'card', 'tab'] as const

/** The `Click` payload: the element's `data-place` / `data-title` / `data-card` / `data-tab`, when set. */
export function clickPayload(element: Element): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const dimension of CLICK_DIMENSIONS) {
    const value = element.getAttribute(`data-${dimension}`)
    if (value) payload[dimension] = value
  }
  return payload
}

/** Tracks a click on an element that describes itself through `data-place` / `data-title` (/ `data-card` / `data-tab`). */
export function trackClick(event: SyntheticEvent<Element>): void {
  track(CLICK_EVENT, clickPayload(event.currentTarget))
}
