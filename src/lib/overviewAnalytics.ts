// Overview page analytics (spec: design/TRACKING_SPEC.md "Overview"). The page moved here from the sites
// repo, so the event names and sites' props are kept for warehouse continuity.
import type { SyntheticEvent } from 'react'
import { SITE_PATH } from '~/config'
import { collectCampaignParams } from '~/lib/campaignParams'
import { sendOverviewPage, sendOverviewTrack } from '~/lib/overviewSegment'

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
/** sites' `SegmentEvent.DOWNLOAD`, the `event` subtype of a Creator Hub download click. */
export const DOWNLOAD_CLICK = 'Download'
/** sites' `DownloadTarget.CREATOR_HUB`. */
export const CREATOR_HUB_TARGET = 'creator_hub'

/**
 * The page's mobile cut, shared by every check that changes its layout or its `mobile` flag. sites used
 * `(max-width: 767px)` and ui2's `down('xs')` (767.95px): below the app's 768px canonical breakpoint.
 */
export const OVERVIEW_MOBILE_QUERY = '(max-width: 767.98px)'

/** The overview page view name: sites sent the full pathname. */
export const OVERVIEW_PAGE_NAME = SITE_PATH

/** Fired once per section per page load, the first time it scrolls into view. */
export function trackSectionViewed(section: OverviewSection, mobile: boolean): void {
  sendOverviewTrack(SECTION_VIEWED_EVENT, { section_viewed: section, mobile })
}

// The warehouse dimensions of a click, read from the element that describes itself through them. A
// whitelist: styled primitives stamp their own `data-*` (variant, size, testid) that must not leak.
const CLICK_DIMENSIONS = [
  ['place', 'place'],
  ['title', 'title'],
  ['card', 'card'],
  ['tab', 'tab'],
  ['event', 'event'],
  ['download-target', 'download_target']
] as const

/** The `Click` payload: the URL's campaign params, then the element's whitelisted `data-*` values. */
export function clickPayload(element: Element): Record<string, string> {
  const payload: Record<string, string> = collectCampaignParams()
  for (const [attribute, prop] of CLICK_DIMENSIONS) {
    const value = element.getAttribute(`data-${attribute}`)
    if (value) payload[prop] = value
  }
  // sites drops an `event` that would only repeat the event name.
  if (payload.event === CLICK_EVENT) delete payload.event
  return payload
}

/** Tracks a click on an element that describes itself through `data-place` / `data-title` / … */
export function trackClick(event: SyntheticEvent<Element>): void {
  sendOverviewTrack(CLICK_EVENT, clickPayload(event.currentTarget))
}

export function trackOverviewPage(): void {
  sendOverviewPage(OVERVIEW_PAGE_NAME)
}
