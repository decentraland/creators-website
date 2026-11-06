import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { itemSizesKey, measureItems } from '~/lib/approveCollection'
import { fetchContentSize } from '~/lib/builder'
import { type Item } from '~/lib/items'

/** Bytes each item uploads to the Catalyst, by item id; measured once per set of content hashes. */
export function useItemSizes(items: Item[] | undefined, enabled: boolean) {
  const queryKey = useMemo(() => itemSizesKey(items ?? []), [items])
  return useQuery({
    queryKey,
    queryFn: () => measureItems(items ?? [], fetchContentSize),
    enabled: enabled && !!items,
    staleTime: Infinity
  })
}
