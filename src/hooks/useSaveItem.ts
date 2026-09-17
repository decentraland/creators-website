import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveItem } from '~/lib/builder'
import { type BuiltItem } from '~/lib/itemFactory'
import { invalidateCollectionItems } from './usePublishCollection'

/** Saves an edited item together with the files the edit produced (thumbnail, video, replaced model). */
export function useSaveItem(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, blobs }: BuiltItem) => {
      if (!address) throw new Error('Wallet disconnected')
      return saveItem(address, item, blobs)
    },
    onSuccess: item => {
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    }
  })
}
