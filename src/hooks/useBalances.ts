import { useQuery } from '@tanstack/react-query'
import { fetchCreditsBalance } from '~/lib/credits'
import { fetchManaBalance } from '~/lib/mana'
import { getMaticChainId } from '~/lib/publishCollection'

export function useCreditsBalance(address: string | undefined) {
  return useQuery({
    queryKey: ['credits-balance', address],
    queryFn: () => fetchCreditsBalance(address!),
    enabled: !!address,
    staleTime: 30_000
  })
}

/** Polygon MANA balance in wei. */
export function useManaBalance(address: string | undefined) {
  const chainId = getMaticChainId()
  return useQuery({
    queryKey: ['mana-balance', address, chainId],
    queryFn: () => fetchManaBalance(address!, chainId),
    enabled: !!address,
    staleTime: 30_000
  })
}
