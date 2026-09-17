// Decentraland feature flags, read from the same service every other dapp reads (ported from shop's
// lib/featureFlags): a cached fetch behind an async accessor, keyed `${app}-${feature}`.
import { config } from '~/config'

/** Flag names as they appear in the service, without the `dapps-` prefix. */
export enum FeatureFlag {
  /**
   * Ceiling for the Unity wearable preview, shared with the shop and the legacy builder: one switch turns
   * Unity off across every dapp. The device heuristic in `lib/pickRenderer` still applies on top.
   */
  UNITY_WEARABLE_PREVIEW = 'unity-wearable-preview'
}

const APPLICATION = 'dapps'
const TTL_MS = 60_000
const TIMEOUT_MS = 3_000

type Snapshot = { flags: Record<string, boolean>; fetchedAt: number }

let snapshot: Snapshot | undefined
let inFlight: Promise<Snapshot> | undefined

function flagKey(flag: FeatureFlag): string {
  return `${APPLICATION}-${flag}`
}

async function fetchSnapshot(): Promise<Snapshot> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${config.get('FEATURE_FLAGS_URL')}/${APPLICATION}.json`, {
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`feature flags request failed with ${response.status}`)
    const body = (await response.json()) as { flags?: Record<string, boolean> }
    return { flags: body.flags ?? {}, fetchedAt: Date.now() }
  } finally {
    clearTimeout(timer)
  }
}

// A failed fetch is not cached: the next read retries, so an outage never outlives itself.
async function getSnapshot(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.fetchedAt < TTL_MS) return snapshot
  if (!inFlight) {
    inFlight = fetchSnapshot()
      .then(fresh => {
        snapshot = fresh
        return fresh
      })
      .finally(() => {
        inFlight = undefined
      })
  }
  return await inFlight
}

/**
 * Local override for dev builds: `VITE_FEATURE_FLAG_OVERRIDES=unity-wearable-preview:true`. Vite drops
 * the branch from production bundles through `import.meta.env.DEV`.
 */
function devOverrideFor(flag: FeatureFlag): boolean | undefined {
  if (!import.meta.env.DEV) return undefined
  const raw = import.meta.env.VITE_FEATURE_FLAG_OVERRIDES
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  for (const entry of raw.split(',')) {
    const separator = entry.indexOf(':')
    if (separator === -1) continue
    if (entry.slice(0, separator).trim() !== String(flag)) continue
    const value = entry.slice(separator + 1).trim()
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return undefined
}

/** Whether a flag is on. Fails closed: an unreachable service, a malformed body or an absent flag read `false`. */
export async function getIsFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const override = devOverrideFor(flag)
  if (override !== undefined) return override
  try {
    return (await getSnapshot()).flags[flagKey(flag)] === true
  } catch {
    return false
  }
}

/** Test seam: drops the cached snapshot so a spec starts from a known state. */
export function resetFeatureFlagsCache(): void {
  snapshot = undefined
  inFlight = undefined
}
