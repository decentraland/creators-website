import { useQuery } from '@tanstack/react-query'
import { CREDIT_PACKS, fetchCreditPacks, type CreditPack } from '~/lib/creditPacks'

/** The credit-pack catalogue, always populated: the bundled packs stand in until, or without, the fetch. */
export function useCreditPacks(): { packs: CreditPack[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['credit-packs'],
    queryFn: fetchCreditPacks,
    staleTime: 5 * 60_000,
    retry: false
  })
  return { packs: data ?? CREDIT_PACKS, isLoading: isLoading && data === undefined }
}
