// Feature-flag state for specs. A spec swaps the real reader for this one with
// `vi.mock('~/lib/featureFlags', ...)` and then declares the flags its subject runs with; anything
// it does not name reads off, exactly as an unreachable service would.
import { afterEach } from 'vitest'
import { type FeatureFlag } from '~/lib/featureFlags'

const enabled = new Set<FeatureFlag>()
const variants = new Map<FeatureFlag, string[]>()

afterEach(() => {
  enabled.clear()
  variants.clear()
})

export function setFeatureFlags(...flags: FeatureFlag[]): void {
  enabled.clear()
  for (const flag of flags) enabled.add(flag)
}

export function getIsFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  return Promise.resolve(enabled.has(flag))
}

/** The address list a flag's variant carries; anything not set reads `[]`, as a flag without a variant would. */
export function setAddressListVariant(flag: FeatureFlag, addresses: string[]): void {
  variants.set(
    flag,
    addresses.map(address => address.toLowerCase())
  )
}

export function getAddressListVariant(flag: FeatureFlag): Promise<string[]> {
  return Promise.resolve(variants.get(flag) ?? [])
}
