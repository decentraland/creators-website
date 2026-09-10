import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type Entity } from '@dcl/schemas'
import { fetchCollectionCuration } from '~/lib/builder'
import { fetchEntitiesByPointers } from '~/lib/catalyst'
import { type Collection } from '~/lib/collections'
import { getItemSyncStatus, isCurationPending, mapEntitiesByItemId, type ItemSyncStatus } from '~/lib/itemSync'
import { type Item } from '~/lib/items'

export type ItemSync = {
  status: ItemSyncStatus
  /** The deployed entity, when there is one — what "Reset item" restores. */
  entity?: Entity
}

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
    () => (isPublished ? items.filter(item => item.isPublished && item.urn).map(item => item.urn!) : []),
    [isPublished, items]
  )

  const entitiesQuery = useQuery({
    queryKey: ['item-entities', collectionId, pointers],
    queryFn: () => fetchEntitiesByPointers(pointers),
    enabled: pointers.length > 0,
    staleTime: 30_000
  })
  const curationQuery = useQuery({
    queryKey: ['collection-curation', address, collectionId],
    queryFn: () => fetchCollectionCuration(address!, collectionId!),
    enabled: !!address && !!collectionId && isPublished,
    staleTime: 30_000
  })

  const entities = entitiesQuery.data
  // A failed entities request settles too: an approved item then reads as unsynced rather than loading forever.
  const entitiesLoaded = pointers.length === 0 || entitiesQuery.isFetched
  const curationPending = isCurationPending(curationQuery.data)

  return useMemo(() => {
    const byItemId = mapEntitiesByItemId(items, entities ?? [])
    const syncs = new Map<string, ItemSync>()
    for (const item of items) {
      const entity = byItemId.get(item.id)
      const status = getItemSyncStatus(item, entity, { isCurationPending: curationPending, entitiesLoaded })
      syncs.set(item.id, entity ? { status, entity } : { status })
    }
    return syncs
  }, [items, entities, curationPending, entitiesLoaded])
}
