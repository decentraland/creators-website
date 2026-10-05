import { useQuery } from '@tanstack/react-query'
import { fetchItemCurations, fetchThirdParty } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { getThirdPartyId } from '~/lib/linkedCollections'

/** The latest curation status of each item of a linked collection, keyed by item id. */
export function useItemCurations(address: string | undefined, collection: Collection | undefined) {
  return useQuery({
    queryKey: ['item-curations', address, collection?.id],
    queryFn: () => fetchItemCurations(address!, collection!.id),
    enabled: !!address && !!collection,
    staleTime: 30_000
  })
}

/** The linked collection's third party: its name for the header, its managers for access. */
export function useThirdParty(address: string | undefined, collection: Collection | undefined) {
  const thirdPartyId = collection ? getThirdPartyId(collection) : undefined
  return useQuery({
    queryKey: ['third-party', address, thirdPartyId],
    queryFn: () => fetchThirdParty(address!, thirdPartyId!),
    enabled: !!address && !!thirdPartyId,
    staleTime: 5 * 60_000,
    retry: false
  })
}
