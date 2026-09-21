import { useQuery } from '@tanstack/react-query'
import { fetchCampaign, type Campaign } from '~/lib/campaign'
import { FeatureFlag, getIsFeatureEnabled } from '~/lib/featureFlags'

const STALE_TIME_MS = 15 * 60_000

/** The running campaign, or null while the flag is off, the CMS has none, or the request failed. */
export function useCampaign(): Campaign | null {
  const { data } = useQuery({
    queryKey: ['campaign'],
    queryFn: async () => ((await getIsFeatureEnabled(FeatureFlag.CAMPAIGN)) ? await fetchCampaign() : null),
    staleTime: STALE_TIME_MS
  })
  return data ?? null
}
