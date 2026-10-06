// Decentraland feature flags, read from the same service every other dapp reads (ported from shop's
// lib/featureFlags): a cached fetch behind an async accessor, keyed `${app}-${feature}`.
import { config } from '~/config'

/** Flag names as they appear in the service, without their application prefix. */
export enum FeatureFlag {
  /**
   * Ceiling for the Unity wearable preview, shared with the shop and the legacy builder: one switch turns
   * Unity off across every dapp. The device heuristic in `lib/pickRenderer` still applies on top.
   */
  UNITY_WEARABLE_PREVIEW = 'unity-wearable-preview',
  /** Marketing campaign surfaces (the event tag hint), shared with the legacy builder. */
  CAMPAIGN = 'campaign',
  /** Platform-wide stop: every surface of this app is replaced with the maintenance notice. */
  MAINTENANCE = 'maintenance',
  /** The item's Utility field, which the catalog surfaces on published items. */
  WEARABLE_UTILITY = 'wearable-utility',
  /** The per-wearable VRM export opt-out. */
  VRM_OPTOUT = 'vrm-optout',
  /** The Blender live preview page (`/live-preview`), fed by the dcl-blender-toolkit add-on. */
  BLENDER_LIVE_PREVIEW = 'blender-live-preview',
  /** Listing items through off-chain public orders (trades), which is the only sale path here. */
  OFFCHAIN_PUBLIC_ITEM_ORDERS = 'offchain-public-item-orders',
  /** Credits as a listing currency; with it off, an item can only be priced in MANA. */
  CREDITS_PRIMARY_LISTINGS = 'credits-primary-listings',
  /** Paying the collection publication fee with shop credits. */
  SHOP_CREDITS_FOR_COLLECTIONS_FEE = 'shop-credits-for-collections-fee',
  /**
   * Items with validation errors block publishing a collection; off, the errors are advisory. A check that could
   * not run (download, worker or rule book failure) is a warning either way: infrastructure never blocks publishing.
   */
  BLOCK_PUBLISH_ON_VALIDATION_ERRORS = 'block-publish-on-validation-errors',
  /**
   * Pre-launch gate. On, the site is live but unannounced: only the wallets in the flag's address-list
   * VARIANT get the full app, everyone else gets the overview alone. Off (or unreachable) means launched.
   * A curtain, not a lock: the bundle is static and builder-server is public, see `useCreatorsPrelaunch`.
   */
  CREATORS_PRELAUNCH = 'creators-prelaunch'
}

/** Each flag lives under the application that owns it, and is fetched from that application's file. */
const APPLICATION: Record<FeatureFlag, string> = {
  [FeatureFlag.UNITY_WEARABLE_PREVIEW]: 'dapps',
  [FeatureFlag.CAMPAIGN]: 'builder',
  [FeatureFlag.MAINTENANCE]: 'builder',
  [FeatureFlag.WEARABLE_UTILITY]: 'dapps',
  [FeatureFlag.VRM_OPTOUT]: 'builder',
  [FeatureFlag.BLENDER_LIVE_PREVIEW]: 'builder',
  [FeatureFlag.OFFCHAIN_PUBLIC_ITEM_ORDERS]: 'dapps',
  [FeatureFlag.CREDITS_PRIMARY_LISTINGS]: 'builder',
  [FeatureFlag.SHOP_CREDITS_FOR_COLLECTIONS_FEE]: 'builder',
  [FeatureFlag.BLOCK_PUBLISH_ON_VALIDATION_ERRORS]: 'builder',
  [FeatureFlag.CREATORS_PRELAUNCH]: 'builder'
}

const TTL_MS = 60_000
const TIMEOUT_MS = 3_000

type Snapshot = { flags: Record<string, boolean>; variants: Record<string, string>; fetchedAt: number }

const snapshots = new Map<string, Snapshot>()
const inFlight = new Map<string, Promise<Snapshot>>()

async function fetchSnapshot(application: string): Promise<Snapshot> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${config.get('FEATURE_FLAGS_URL')}/${application}.json`, {
      signal: controller.signal
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`feature flags request failed with ${response.status}`)
    }
    // Only a variant's string payload is kept (an address list, for one): holding the service's envelope
    // would invite code that depends on its shape.
    const body = (await response.json()) as {
      flags?: Record<string, boolean>
      variants?: Record<string, { enabled?: boolean; payload?: { value?: string } }>
    }
    const variants: Record<string, string> = {}
    for (const [key, variant] of Object.entries(body.variants ?? {})) {
      if (variant?.enabled && typeof variant.payload?.value === 'string') variants[key] = variant.payload.value
    }
    return { flags: body.flags ?? {}, variants, fetchedAt: Date.now() }
  } finally {
    clearTimeout(timer)
  }
}

// A failed fetch is not cached: the next read retries, so an outage never outlives itself.
async function getSnapshot(application: string): Promise<Snapshot> {
  const cached = snapshots.get(application)
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached
  let pending = inFlight.get(application)
  if (!pending) {
    pending = fetchSnapshot(application)
      .then(fresh => {
        snapshots.set(application, fresh)
        return fresh
      })
      .finally(() => {
        inFlight.delete(application)
      })
    inFlight.set(application, pending)
  }
  return await pending
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

/**
 * Local override for a flag's VARIANT payload, dev builds only. Entries are `;`-separated because a payload is
 * itself a comma-separated list: `VITE_FEATURE_FLAG_VARIANT_OVERRIDES=creators-prelaunch:0xabc…,0xdef…;other:…`.
 */
function devVariantOverrideFor(flag: FeatureFlag): string | undefined {
  if (!import.meta.env.DEV) return undefined
  const raw = import.meta.env.VITE_FEATURE_FLAG_VARIANT_OVERRIDES
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  for (const entry of raw.split(';')) {
    const separator = entry.indexOf(':')
    if (separator === -1) continue
    if (entry.slice(0, separator).trim() !== String(flag)) continue
    return entry.slice(separator + 1).trim()
  }
  return undefined
}

// Any mix of commas, semicolons and whitespace separates addresses: a dashboard payload is as often
// one address per line as a comma list.
function parseAddressList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map(address => address.toLowerCase())
        .filter(address => /^0x[0-9a-f]{40}$/.test(address))
    )
  )
}

/**
 * The addresses in a flag's variant payload, lowercased and de-duplicated. An absent flag, a disabled
 * variant, an unreachable service or an unparseable payload all read `[]`: "no list", never "a list that
 * excludes everyone", so a caller deciding who to exclude checks that the FLAG is on separately.
 */
export async function getAddressListVariant(flag: FeatureFlag): Promise<string[]> {
  const override = devVariantOverrideFor(flag)
  if (override !== undefined) return parseAddressList(override)
  const application = APPLICATION[flag]
  try {
    const value = (await getSnapshot(application)).variants[`${application}-${flag}`]
    return value ? parseAddressList(value) : []
  } catch {
    return []
  }
}

/** Whether a flag is on. Fails closed: an unreachable service, a malformed body or an absent flag read `false`. */
export async function getIsFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const override = devOverrideFor(flag)
  if (override !== undefined) return override
  const application = APPLICATION[flag]
  try {
    return (await getSnapshot(application)).flags[`${application}-${flag}`] === true
  } catch {
    return false
  }
}

/** Test seam: drops the cached snapshot so a spec starts from a known state. */
export function resetFeatureFlagsCache(): void {
  snapshots.clear()
  inFlight.clear()
}
