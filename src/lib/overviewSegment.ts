// The overview page's sender (spec: design/TRACKING_SPEC.md "Overview"). Its events feed sites' warehouse
// tables and Metabase cards, so they go to sites' Segment source.
import { config } from '~/config'
import { sendDirect } from '~/lib/analytics'

type Props = Record<string, unknown>

const writeKey = () => config.get('SITES_SEGMENT_API_KEY', '')

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
