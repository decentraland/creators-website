import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEntitiesByPointers } from '~/lib/catalyst'
import { useCollectionCuration } from '~/hooks/useCuration'
import { type Collection } from '~/lib/collections'
import { getItemSyncStatus, mapEntitiesByItemId, type ItemSync } from '~/lib/itemSync'
import { type Item } from '~/lib/items'

export type { ItemSync }

/**
 * Each item's Catalyst sync status. Only published items have anything deployed, so drafts cost no
 * request; the collection's pending curation turns "unsynced" into "under review".
 */
export function useItemSyncs(
  address: string | undefined,
  collection: Collection | undefined,
  items: Item[]
): Map<string, ItemSync> {
  const collectionId = collection?.id
  const isPublished = !!collection?.isPublished
  const pointers = useMemo(
    () => (isPublished ? items.flatMap(item => (item.isPublished && item.urn ? [item.urn] : [])) : []),
    [isPublished, items]
  )

  const entitiesQuery = useQuery({
    queryKey: ['item-entities', collectionId, pointers],
    queryFn: () => fetchEntitiesByPointers(pointers),
    enabled: pointers.length > 0,
    staleTime: 30_000
  })
  const curationQuery = useCollectionCuration(address, collection)

  const entities = entitiesQuery.data
  // Only a successful answer settles it: during a Catalyst outage an approved item reads as loading, not as missing
  // its entity (which would offer Deploy missing entities and Publish changes for nothing).
  const entitiesLoaded = pointers.length === 0 || entitiesQuery.isSuccess
  const curationPending = curationQuery.data?.status === 'pending'
  // A failed request settles too: the statuses then read as if nothing were pending rather than never resolving.
  const curationLoaded = !isPublished || curationQuery.isSuccess || curationQuery.isError

  return useMemo(() => {
    const byItemId = mapEntitiesByItemId(items, entities ?? [])
    const syncs = new Map<string, ItemSync>()
    for (const item of items) {
      const entity = byItemId.get(item.id)
      const status = getItemSyncStatus(item, entity, {
        isCurationPending: curationPending,
        curationLoaded,
        entitiesLoaded
      })
      syncs.set(item.id, entity ? { status, entity } : { status })
    }
    return syncs
  }, [items, entities, curationPending, curationLoaded, entitiesLoaded])
}
