import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { captureError } from '~/lib/monitoring'
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

/**
 * The item's stored thumbnail, or null when it has none or storage fails: a rarity change then saves without
 * refreshing the catalyst image rather than failing the whole save, and the failure is reported.
 */
export async function fetchStoredThumbnail(item: Item): Promise<Blob | null> {
  const hash = item.contents[item.thumbnail]
  if (!hash) return null
  try {
    return await fetchContent(hash)
  } catch (error) {
    captureError(error, { flow: 'save-item', itemId: item.id })
    return null
  }
}

/** What the save sends: a new thumbnail wins; a rarity change alone rebuilds the catalyst image. */
export async function buildSaveItem({ item, blobs, thumbnail, imageStale }: SaveItemVariables): Promise<BuiltItem> {
  if (thumbnail) return withThumbnail(item, thumbnail)
  const stored = imageStale ? await fetchStoredThumbnail(item) : null
  if (stored) return withCatalystImageForRarity(item, stored)
  return { item, blobs: blobs ?? {} }
}

/** Saves an item together with any files the edit produced (thumbnail, video, replaced model). */
export function useSaveItem(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (variables: SaveItemVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      const built = await buildSaveItem(variables)
      return saveItem(address, built.item, built.blobs)
    },
    onSuccess: item => {
      track('Save item', { itemId: item.id })
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    },
    onError: (error, { item }) => track('Save item error', { itemId: item.id, error: errorCode(error) })
  })
}
