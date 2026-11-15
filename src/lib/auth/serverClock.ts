// Signed requests (ADR-44) carry the device's clock as their timestamp, and the servers reject one more than
// 60s in their past. A device clock that is behind therefore has every signed request refused: builder-server
// answers 401 "Unauthenticated", credits-server "Expired signature". This module measures how far the device
// clock is from the servers' and lets signing correct for it, so a wrong device clock no longer locks the
// creator out.
import { config } from '~/config'

/**
 * Drift below this is left alone: it fits inside the servers' 60s window with room for latency, and a
 * correction measured over a slow network would be noisier than the drift itself.
 */
export const MAX_UNCORRECTED_DRIFT_MS = 30 * 1000

let offsetMs = 0
let pending: Promise<boolean> | null = null

/** The time to sign with: the device clock, corrected by the last measured offset. */
export function serverNow(): number {
  return Date.now() + offsetMs
}

/** Reads credits-server's public `/status` (`currentTime`, CORS-enabled) and returns the offset it implies. */
async function measureOffset(): Promise<number | null> {
  const sentAt = Date.now()
  const response = await fetch(`${config.get('CREDITS_SERVER_URL')}/status`)
  const receivedAt = Date.now()
  const body = (await response.json().catch(() => null)) as { currentTime?: unknown } | null
  if (!response.ok || typeof body?.currentTime !== 'number' || !Number.isFinite(body.currentTime)) return null
  // The server read its clock somewhere during the round trip: its midpoint is the best estimate.
  return body.currentTime - (sentAt + receivedAt) / 2
}

/**
 * Re-measures the clock offset after a signed request was refused. Resolves true when the correction to
 * sign with changed, i.e. when retrying the request can now succeed. Fails closed to "nothing changed":
 * when the server time can't be read, the refusal stands as it was.
 * Concurrent refusals (the page's queries fail together) share one measurement.
 */
export function resyncServerClock(): Promise<boolean> {
  pending ??= (async () => {
    try {
      const measured = await measureOffset()
      if (measured === null) return false
      const next = Math.abs(measured) > MAX_UNCORRECTED_DRIFT_MS ? Math.round(measured) : 0
      const changed = Math.abs(next - offsetMs) > MAX_UNCORRECTED_DRIFT_MS
      if (changed) offsetMs = next
      return changed
    } catch {
      return false
    } finally {
      pending = null
    }
  })()
  return pending
}

/** Test seam: forget the measured offset. */
export function resetServerClock(): void {
  offsetMs = 0
  pending = null
}
