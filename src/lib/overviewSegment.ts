// The overview page's sender (spec: design/TRACKING_SPEC.md "Overview"). Its events feed sites' warehouse
// tables and Metabase cards, so they go to sites' Segment source; without that key they land in this
// app's own source instead of being dropped.
import { config } from '~/config'
import { sendDirect } from '~/lib/analytics'

type Props = Record<string, unknown>

let warnedFallback = false

function writeKey(): string {
  const sitesKey = config.get('SITES_SEGMENT_API_KEY', '')
  if (sitesKey) return sitesKey
  if (import.meta.env.DEV && !warnedFallback) {
    warnedFallback = true
    console.warn("[analytics] SITES_SEGMENT_API_KEY is empty: overview events go to this app's Segment source")
  }
  return config.get('SEGMENT_API_KEY', '')
}

/**
 * Sends an overview event. `track_*` mirror sites' deferred-track observability fields; this transport
 * never queues, so the call is delivered the moment it is made.
 */
export function sendOverviewTrack(event: string, props: Props): void {
  const now = Date.now()
  sendDirect(
    writeKey(),
    { type: 'track', event },
    { ...props, track_called_at: now, track_delivered_at: now, track_deferred: false }
  )
}

/** Sends the overview page view. */
export function sendOverviewPage(name: string): void {
  sendDirect(writeKey(), { type: 'page', name })
}
