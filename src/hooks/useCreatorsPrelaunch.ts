import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { track } from '~/lib/analytics'
import { FeatureFlag, getAddressListVariant, getIsFeatureEnabled } from '~/lib/featureFlags'
import { useWallet } from '~/store/wallet'

export type PrelaunchDecision =
  /** Not known yet: the flag or the wallet restore is still outstanding. */
  | 'pending'
  /** The full app. */
  | 'open'
  /** The overview alone; every other route is not found. */
  | 'hidden'

/**
 * The pre-launch gate: with `creators-prelaunch` on, only the wallets in its address-list variant get the full
 * app. Cosmetic by construction (the bundle is static and builder-server is public and shared with the legacy
 * builder), so it keeps an unannounced surface out of sight rather than locking anything.
 *
 * Fails OPEN: an unreachable flag service reads the flag as off, which here means launched. A flag outage on
 * launch day must never curtain the site for everyone. Which environments are gated is decided in the flag
 * dashboard alone (dev/stg and prod read different flag files), not by any hostname check here.
 */
export function useCreatorsPrelaunch(): PrelaunchDecision {
  const address = useWallet(s => s.session?.address)
  // `address` alone cannot tell "no wallet" from "not restored yet", and deciding before the restore settles
  // would show an allowed wallet the curtain for a moment on every refresh.
  const restored = useWallet(s => s.restored)

  const { data, isPending } = useQuery({
    queryKey: ['feature-flag', FeatureFlag.CREATORS_PRELAUNCH, 'gate'],
    queryFn: async () => {
      const armed = await getIsFeatureEnabled(FeatureFlag.CREATORS_PRELAUNCH)
      return { armed, allowed: armed ? await getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH) : [] }
    },
    // Matches the lib's cache TTL so the two don't compete.
    staleTime: 60_000,
    refetchOnWindowFocus: true
  })

  const decision = decide(data, isPending, restored, address)

  useEffect(() => {
    if (data?.armed && decision !== 'pending') track('Prelaunch gate', { outcome: decision })
  }, [data?.armed, decision])

  return decision
}

function decide(
  data: { armed: boolean; allowed: string[] } | undefined,
  isPending: boolean,
  restored: boolean,
  address: string | undefined
): PrelaunchDecision {
  if (isPending) return 'pending'
  // A settled query with no data failed; the lib swallows its own errors so this is unreachable today, but
  // the fail-open contract must not rest on that.
  if (!data || !data.armed) return 'open'
  if (!restored) return 'pending'
  // An empty list means nobody has been let in yet, the same as not being on it.
  if (!address) return 'hidden'
  return data.allowed.includes(address.toLowerCase()) ? 'open' : 'hidden'
}
