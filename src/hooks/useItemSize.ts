// Item sizes on screen (lib/itemSize): stored files measured by content hash through the query cache, and the item
// a save would send measured before it is sent, so what the editor shows is what the save enforces.
import { useCallback, useMemo } from 'react'
import { useQueries, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { fetchContent, fetchContentSize } from '~/lib/builder'
import { buildMissingImage } from '~/lib/catalystEntity'
import { ItemFileError } from '~/lib/itemFiles'
import { measureItem, measureItemBytes, type ItemSize, type MeasurableItem, type MeasureDeps } from '~/lib/itemSize'
import { type Item } from '~/lib/items'
import { generateCatalystImage } from '~/lib/media'
import { captureError } from '~/lib/monitoring'

const imageDeps = { fetchContent, renderCatalystImage: generateCatalystImage }

export const contentSizeKey = (hash: string) => ['content-size', hash] as const

/**
 * Measuring for the app: a content hash names bytes that never change, so each stored file's size is read once and
 * cached; a legacy item saved without image.png gets the one the approval flow would render for it at deploy.
 */
export function itemSizeDeps(queryClient: QueryClient): MeasureDeps {
  return {
    sizeOf: hash =>
      queryClient.fetchQuery({
        queryKey: contentSizeKey(hash),
        queryFn: () => fetchContentSize(hash),
        staleTime: Infinity
      }),
    imageOf: item => (item.contents[item.thumbnail] ? buildMissingImage(item, imageDeps) : Promise.resolve(null))
  }
}

export function useItemSizeDeps(): MeasureDeps {
  const queryClient = useQueryClient()
  return useMemo(() => itemSizeDeps(queryClient), [queryClient])
}

export type MeasuredBytes = { bytes: number | null; isMeasuring: boolean }

/**
 * The bytes of the item `build` resolves to, counted as the catalyst counts them: what a save would send, measured
 * before it is sent. `key` names the inputs that change the files (use `identityKey` for blobs and items); a new key
 * measures again with that render's `build`, and `build` null measures nothing. A build that can't be made yet (an
 * ItemFileError) or a measurement that fails leaves `bytes` null, the latter reported: nothing is blocked on a
 * measurement that didn't happen, and the save re-checks.
 */
export function useMeasuredBytes(
  build: (() => Promise<MeasurableItem | null>) | null,
  key: readonly unknown[],
  flow: string
): MeasuredBytes {
  const deps = useItemSizeDeps()
  const query = useQuery({
    queryKey: ['measured-item-size', flow, ...key],
    queryFn: async () => {
      try {
        const built = await build!()
        return built ? await measureItemBytes(built, deps) : null
      } catch (error) {
        if (!(error instanceof ItemFileError)) captureError(error, { flow, step: 'measure_size' })
        return null
      }
    },
    enabled: build !== null,
    staleTime: Infinity,
    retry: false
  })
  return { bytes: build ? (query.data ?? null) : null, isMeasuring: build !== null && query.isFetching }
}

/** A saved item's size key: its stored files plus what decides its limit and a missing rarity image. */
export const itemSizeKey = (item: Item) =>
  [
    'item-size',
    item.id,
    item.type,
    item.data.category ?? null,
    item.rarity ?? null,
    item.thumbnail,
    Object.entries(item.contents).sort(([a], [b]) => a.localeCompare(b))
  ] as const

export type ItemSizes = {
  /** By item id; an item missing here is still being measured or could not be. */
  sizes: Map<string, ItemSize>
  isMeasuring: boolean
}

/** The saved items' sizes as the catalyst counts them. A measurement that fails is reported and leaves the item out. */
export function useItemSizes(items: Item[]): ItemSizes {
  const deps = useItemSizeDeps()
  const queries = useMemo(
    () =>
      items.map(item => ({
        queryKey: itemSizeKey(item),
        queryFn: () =>
          measureItem({ item }, deps).catch((error: unknown) => {
            captureError(error, { flow: 'item_size', itemId: item.id })
            throw error
          }),
        staleTime: Infinity,
        retry: false
      })),
    [items, deps]
  )
  // Stable, so the combined result keeps its identity until a size actually changes.
  const combine = useCallback(
    (results: UseQueryResult<ItemSize>[]): ItemSizes => {
      const sizes = new Map<string, ItemSize>()
      results.forEach((result, index) => {
        if (result.data && items[index]) sizes.set(items[index].id, result.data)
      })
      return { sizes, isMeasuring: results.some(result => result.isPending) }
    },
    [items]
  )
  return useQueries({ queries, combine })
}
