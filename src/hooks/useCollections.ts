import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchCollectionItemPreviews, fetchCollections } from '~/lib/builder'
import { CollectionStatusFilter, CollectionType, statusFilterToParams, type CollectionSort } from '~/lib/collections'

// Same page size as the legacy builder's collections page.
export const COLLECTIONS_PAGE_SIZE = 20

export type CollectionsFilters = {
  page: number
  search: string
  status: CollectionStatusFilter
  sort?: CollectionSort
}

export function useCollections(address: string | undefined, { page, search, status, sort }: CollectionsFilters) {
  return useQuery({
    queryKey: ['collections', address, page, search, status, sort],
    queryFn: () =>
      fetchCollections(address!, {
        page,
        limit: COLLECTIONS_PAGE_SIZE,
        q: search || undefined,
        type: CollectionType.STANDARD,
        sort,
        ...statusFilterToParams(status)
      }),
    enabled: !!address,
    // Keeps the previous page rendered while the next one loads, like the legacy page.
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

/** Total rejected collections, for the badge on the Rejected filter chip. */
export function useRejectedCollectionsCount(address: string | undefined) {
  return useQuery({
    queryKey: ['collections-rejected-count', address],
    queryFn: () =>
      fetchCollections(address!, {
        page: 1,
        limit: 1,
        type: CollectionType.STANDARD,
        ...statusFilterToParams(CollectionStatusFilter.REJECTED)
      }),
    enabled: !!address,
    staleTime: 30_000,
    select: data => data.total
  })
}

/** First 4 item thumbnails of a collection, for the 2x2 mosaic cover. */
export function useCollectionPreview(address: string | undefined, collectionId: string, itemCount: number) {
  return useQuery({
    queryKey: ['collection-preview', collectionId],
    queryFn: () => fetchCollectionItemPreviews(address, collectionId),
    enabled: itemCount > 0,
    staleTime: 5 * 60_000
  })
}
