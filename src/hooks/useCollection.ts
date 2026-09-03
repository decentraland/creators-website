import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAllCollectionItems,
  fetchCollection,
  fetchCollectionItems,
  saveCollection,
  deleteCollection
} from '~/lib/builder'
import { buildCollectionInitializeData } from '~/lib/saveCollection'
import { type Collection } from '~/lib/collections'

export const ITEMS_PAGE_SIZE = 20

export function useCollection(address: string | undefined, collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collection', address, collectionId],
    queryFn: () => fetchCollection(address!, collectionId!),
    enabled: !!address && !!collectionId,
    staleTime: 30_000
  })
}

export function useCollectionItems(address: string | undefined, collectionId: string | undefined, page: number) {
  return useQuery({
    queryKey: ['collection-items', address, collectionId, page],
    queryFn: () => fetchCollectionItems(address!, collectionId!, { page, limit: ITEMS_PAGE_SIZE }),
    enabled: !!address && !!collectionId,
    // Keeps the previous page rendered while the next one loads, like the collections page.
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

/** Every item of the collection — the add-items flow needs them all as variant targets. */
export function useAllCollectionItems(address: string | undefined, collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collection-items-all', address, collectionId],
    queryFn: () => fetchAllCollectionItems(address!, collectionId!),
    enabled: !!address && !!collectionId,
    staleTime: 30_000
  })
}

/**
 * Create or rename a collection. Mirrors the legacy save-collection saga: for a collection that
 * already has items the initialize calldata is regenerated over all of them, so the server derives
 * the same contract address it would in the legacy builder.
 */
export function useSaveCollection(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (collection: Collection) => {
      if (!address) throw new Error('Wallet disconnected')
      const items = collection.itemCount > 0 ? await fetchAllCollectionItems(address, collection.id) : []
      const data = buildCollectionInitializeData(collection, items, address)
      return saveCollection(address, collection, data)
    },
    onSuccess: saved => {
      queryClient.setQueryData(['collection', address, saved.id], saved)
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    }
  })
}

export function useDeleteCollection(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (collectionId: string) => {
      if (!address) throw new Error('Wallet disconnected')
      await deleteCollection(address, collectionId)
      return collectionId
    },
    onSuccess: collectionId => {
      queryClient.removeQueries({ queryKey: ['collection', address, collectionId] })
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    }
  })
}
