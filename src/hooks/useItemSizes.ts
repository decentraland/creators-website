import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { itemSizesKey, measureItems, type MissingImage } from '~/lib/approveCollection'
import { fetchContentSize } from '~/lib/builder'
import { type Item } from '~/lib/items'

/**
 * Bytes each item uploads to the Catalyst, by item id; measured once per set of content hashes. `imageOf` adds the
 * image.png the deploy renders for a standard item saved without one; pass a stable function.
 */
export function useItemSizes(
  items: Item[] | undefined,
  enabled: boolean,
  imageOf?: (item: Item) => Promise<MissingImage | null>
) {
  const queryKey = useMemo(() => itemSizesKey(items ?? []), [items])
  return useQuery({
    queryKey,
    queryFn: () => measureItems(items ?? [], fetchContentSize, imageOf),
    enabled: enabled && !!items,
    staleTime: Infinity
  })
}
