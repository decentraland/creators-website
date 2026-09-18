import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveItem } from '~/lib/builder'
import { withThumbnail, type BuiltItem } from '~/lib/itemFactory'
import { type Item } from '~/lib/items'
import { invalidateCollectionItems } from './usePublishCollection'

export type SaveItemVariables = Partial<BuiltItem> & {
  item: Item
  /** A raw PNG to become the item's thumbnail; hashed here, with the catalyst image alongside. */
  thumbnail?: Blob
}

/** Saves an item together with any files the edit produced (thumbnail, video, replaced model). */
export function useSaveItem(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, blobs, thumbnail }: SaveItemVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      const built = thumbnail ? await withThumbnail(item, thumbnail) : { item, blobs: blobs ?? {} }
      return saveItem(address, built.item, built.blobs)
    },
    onSuccess: item => {
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    }
  })
}
