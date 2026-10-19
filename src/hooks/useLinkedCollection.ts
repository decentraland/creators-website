import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchItemCurations,
  fetchLinkedCollectionItems,
  fetchThirdParty,
  fetchThirdPartySlots,
  type LinkedItemsPage
} from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { linkedItemFilterToQuery, type LinkedItemFilter } from '~/lib/linkedItemStatus'
import { getThirdPartyId } from '~/lib/thirdParty'

// Same page size as the legacy third-party collection page.
export const LINKED_ITEMS_PAGE_SIZE = 50

export function itemCurationsKey(address: string | undefined, collectionId: string | undefined) {
  return ['item-curations', address, collectionId] as const
}

/** The latest curation of each item of a linked collection, keyed by item id. */
export function useItemCurations(address: string | undefined, collection: Collection | undefined, items?: Item[]) {
  const itemIds = items?.map(item => item.id)
  return useQuery({
    queryKey: [...itemCurationsKey(address, collection?.id), itemIds],
    queryFn: () => fetchItemCurations(address!, collection!.id, itemIds),
    enabled: !!address && !!collection && (!items || items.length > 0),
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

export function thirdPartyKey(address: string | undefined, thirdPartyId: string | undefined) {
  return ['third-party', address, thirdPartyId] as const
}

/** The linked collection's third party: its name for the header, its managers for access, its kind and root. */
export function useThirdParty(address: string | undefined, collection: Collection | undefined) {
  const thirdPartyId = collection ? getThirdPartyId(collection) : undefined
  return useQuery({
    queryKey: thirdPartyKey(address, thirdPartyId),
    queryFn: () => fetchThirdParty(address!, thirdPartyId!),
    enabled: !!address && !!thirdPartyId,
    staleTime: 5 * 60_000,
    retry: false
  })
}

export function thirdPartySlotsKey(address: string | undefined, thirdPartyId: string | undefined) {
  return ['third-party-slots', address, thirdPartyId] as const
}

/** Item slots the third party still has, for the publish fee. */
export function useThirdPartySlots(address: string | undefined, thirdPartyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: thirdPartySlotsKey(address, thirdPartyId),
    queryFn: () => fetchThirdPartySlots(address!, thirdPartyId!),
    enabled: !!address && !!thirdPartyId && enabled,
    staleTime: 30_000
  })
}

export function linkedItemsKey(address: string | undefined, collectionId: string | undefined) {
  return ['linked-items', address, collectionId] as const
}

/** One server-filtered page of a linked collection's items. */
export function useLinkedCollectionItems(
  address: string | undefined,
  collection: Collection | undefined,
  page: number,
  filter: LinkedItemFilter,
  limit = LINKED_ITEMS_PAGE_SIZE
) {
  return useQuery<LinkedItemsPage>({
    queryKey: [...linkedItemsKey(address, collection?.id), page, filter, limit],
    queryFn: () => fetchLinkedCollectionItems(address!, collection!.id, page, limit, linkedItemFilterToQuery(filter)),
    enabled: !!address && !!collection,
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}
