import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { fetchContent, saveItem } from '~/lib/builder'
import { withCatalystImageForRarity, withThumbnail, type BuiltItem } from '~/lib/itemFactory'
import { type Item } from '~/lib/items'
import { invalidateCollectionItems } from './usePublishCollection'

export type SaveItemVariables = Partial<BuiltItem> & {
  item: Item
  /** A raw PNG to become the item's thumbnail; hashed here, with the catalyst image alongside. */
  thumbnail?: Blob
  /** The rarity changed without a new thumbnail: the catalyst image is rebuilt from the stored one. */
  imageStale?: boolean
}

async function build({ item, blobs, thumbnail, imageStale }: SaveItemVariables): Promise<BuiltItem> {
  if (thumbnail) return withThumbnail(item, thumbnail)
  if (imageStale && item.contents[item.thumbnail]) {
    return withCatalystImageForRarity(item, await fetchContent(item.contents[item.thumbnail]))
  }
  return { item, blobs: blobs ?? {} }
}

/** Saves an item together with any files the edit produced (thumbnail, video, replaced model). */
export function useSaveItem(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (variables: SaveItemVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      const built = await build(variables)
      return saveItem(address, built.item, built.blobs)
    },
    onSuccess: item => {
      track('Save item', { itemId: item.id })
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    },
    onError: (error, { item }) => track('Save item error', { itemId: item.id, error: errorCode(error) })
  })
}
