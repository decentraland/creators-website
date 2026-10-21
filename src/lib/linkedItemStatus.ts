// Per-item state of linked collections, ported from the legacy builder (item/selectors getStatusForTP,
// item/utils isAllowedToPushChanges, ItemStatusBadge). Linked items are curated one by one: their latest
// item curation, not the collection, says where they stand.
import { CurationStatus } from './collections'
import { type Item } from './items'

export type RemoteItemCuration = {
  id: string
  item_id: string
  status: CurationStatus
  content_hash: string
  is_mapping_complete: boolean | null
  created_at: string
  updated_at: string
}

export type ItemCuration = {
  id: string
  itemId: string
  status: CurationStatus
  /** The builder copy's content hash when the curation was opened. */
  contentHash: string
  isMappingComplete: boolean | null
  createdAt: number
  updatedAt: number
}

export function fromRemoteItemCuration(remote: RemoteItemCuration): ItemCuration {
  return {
    id: remote.id,
    itemId: remote.item_id,
    status: remote.status,
    contentHash: remote.content_hash,
    isMappingComplete: remote.is_mapping_complete,
    createdAt: +new Date(remote.created_at),
    updatedAt: +new Date(remote.updated_at)
  }
}

export enum LinkedItemStatus {
  /** Never sent for review (or its last request was rejected). */
  READY_TO_PUBLISH = 'ready_to_publish',
  UNDER_REVIEW = 'under_review',
  REJECTED = 'rejected',
  /** Approved and in the Catalyst as last reviewed. */
  PUBLISHED = 'published',
  /** Approved, then edited: the changes wait to be sent for review. */
  READY_TO_PUSH = 'ready_to_push',
  /** The item has no token mapping yet, so it can't be published. */
  PENDING_MAPPING = 'pending_mapping',
  /** Published before mappings existed: its mapping has not been reviewed yet. */
  PENDING_MIGRATION = 'pending_migration'
}

/** Whether the item has ever been sent for review: builder-server locks URN edits and deletes from then on. */
export function isLinkedItemPublished(item: Item, curation: ItemCuration | null | undefined): boolean {
  return item.isPublished || !!curation
}

/** The row's status; `curation` is the item's latest item curation, null when it has none. */
export function getLinkedItemStatus(item: Item, curation: ItemCuration | null | undefined): LinkedItemStatus {
  if (!item.mappings) return LinkedItemStatus.PENDING_MAPPING
  if (item.isMappingComplete === false) return LinkedItemStatus.PENDING_MIGRATION
  if (!curation) return LinkedItemStatus.READY_TO_PUBLISH
  if (curation.status === CurationStatus.PENDING) return LinkedItemStatus.UNDER_REVIEW
  if (curation.status === CurationStatus.REJECTED) return LinkedItemStatus.REJECTED
  if (curation.status === CurationStatus.APPROVED) {
    return item.currentContentHash !== item.catalystContentHash
      ? LinkedItemStatus.READY_TO_PUSH
      : LinkedItemStatus.PUBLISHED
  }
  return LinkedItemStatus.READY_TO_PUBLISH
}

/** Items that go through the publish flow (a cheque and, when slots are missing, a fee). */
export function canPublishLinkedItem(status: LinkedItemStatus): boolean {
  return status === LinkedItemStatus.READY_TO_PUBLISH || status === LinkedItemStatus.REJECTED
}

/**
 * Items whose changes can be sent for review again without a cheque (legacy isAllowedToPushChanges): approved
 * ones whose builder copy no longer matches what curation last saw.
 */
export function canPushLinkedItem(item: Item, curation: ItemCuration | null | undefined): boolean {
  if (!item.isApproved || !curation) return false
  if (curation.status === CurationStatus.REJECTED) return false
  if (item.currentContentHash !== item.catalystContentHash) return true
  return curation.contentHash !== item.currentContentHash
}

export type LinkedPublishAction = 'publish' | 'push' | 'publish_and_push'

export type LinkedSelection = { toPublish: Item[]; toPush: Item[] }

/** Splits the selected items into the ones to publish and the ones to push, as the legacy publish button does. */
export function splitLinkedSelection(selected: Iterable<Item>, curations: Map<string, ItemCuration>): LinkedSelection {
  const toPublish: Item[] = []
  const toPush: Item[] = []
  for (const item of selected) {
    const curation = curations.get(item.id) ?? null
    if (canPublishLinkedItem(getLinkedItemStatus(item, curation))) toPublish.push(item)
    else if (canPushLinkedItem(item, curation)) toPush.push(item)
  }
  return { toPublish, toPush }
}

export function getLinkedPublishAction(selection: LinkedSelection): LinkedPublishAction | null {
  if (selection.toPublish.length > 0 && selection.toPush.length > 0) return 'publish_and_push'
  if (selection.toPublish.length > 0) return 'publish'
  if (selection.toPush.length > 0) return 'push'
  return null
}

/** Whether a row can be selected for the publish button at all. */
export function isLinkedItemSelectable(item: Item, curation: ItemCuration | null | undefined): boolean {
  const status = getLinkedItemStatus(item, curation)
  return canPublishLinkedItem(status) || canPushLinkedItem(item, curation)
}

/** The filters of the linked collection's item list, mapped to builder-server's query params. */
export enum LinkedItemFilter {
  ALL = 'all',
  PUBLISHED = 'published',
  READY_TO_PUSH = 'ready_to_push',
  PENDING_MAPPING = 'pending_mapping',
  PENDING_MIGRATION = 'pending_migration'
}

export type LinkedItemsQuery = {
  synced?: boolean
  mappingStatus?: 'missing_mapping' | 'unpublished_mapping'
}

export function linkedItemFilterToQuery(filter: LinkedItemFilter): LinkedItemsQuery {
  switch (filter) {
    case LinkedItemFilter.PUBLISHED:
      return { synced: true }
    case LinkedItemFilter.READY_TO_PUSH:
      return { synced: false }
    case LinkedItemFilter.PENDING_MAPPING:
      return { mappingStatus: 'missing_mapping' }
    case LinkedItemFilter.PENDING_MIGRATION:
      return { mappingStatus: 'unpublished_mapping' }
    default:
      return {}
  }
}

export function parseLinkedItemFilter(raw: string | null): LinkedItemFilter {
  return Object.values(LinkedItemFilter).includes(raw as LinkedItemFilter)
    ? (raw as LinkedItemFilter)
    : LinkedItemFilter.ALL
}
