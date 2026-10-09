// Whether a published item still matches the entity deployed to the Catalyst — the version the world
// and the marketplace show. Ported from the legacy builder (modules/item/utils areSynced + the
// getStatusForStandard selector) so both apps judge the same item the same way.
import { type Entity } from '@dcl/schemas'
import { type Collection } from './collections'
import { type CollectionCuration } from './curation'
import { ItemType, VIDEO_PATH, type Item, type ItemData, type ItemRepresentation } from './items'

/** Edited after approval (submitted for review or not): the Shop and the world still serve the approved version. */
export function hasPendingChanges(status: ItemSyncStatus | undefined): boolean {
  return status === ItemSyncStatus.UNSYNCED || status === ItemSyncStatus.UNDER_REVIEW
}

export enum ItemSyncStatus {
  UNPUBLISHED = 'unpublished',
  /** On-chain, waiting for the committee — either the first review or a pushed change. */
  UNDER_REVIEW = 'under_review',
  SYNCED = 'synced',
  /** Approved, but the builder copy differs from the deployed entity (or none is deployed). */
  UNSYNCED = 'unsynced',
  LOADING = 'loading'
}

// Both the wearable and the ADR-74 emote schemas carry the item fields the builder edits.
type CatalystItemMetadata = {
  id: string
  name: string
  description: string
  data?: ItemData
  emoteDataADR74?: ItemData
}

// Hash of an empty file: directory entries and 0-byte files are never deployed.
const EMPTY_CONTENT_HASH = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'

/** The item fields as deployed: `data` for wearables, `emoteDataADR74` for emotes. */
function getEntityItemData(entity: Entity): ItemData | undefined {
  const metadata = entity.metadata as CatalystItemMetadata
  return metadata.emoteDataADR74 ?? metadata.data
}

/** The entity deployed for each item, keyed by item id, matched through the item URN. */
export function mapEntitiesByItemId(items: Item[], entities: Entity[]): Map<string, Entity> {
  const itemIdByUrn = new Map<string, string>()
  for (const item of items) {
    if (item.urn) itemIdByUrn.set(item.urn, item.id)
  }
  const byItemId = new Map<string, Entity>()
  for (const entity of entities) {
    const itemId = itemIdByUrn.get((entity.metadata as CatalystItemMetadata).id)
    if (itemId) byItemId.set(itemId, entity)
  }
  return byItemId
}

/** The paths an item deploys: directory entries and empty files never reach the Catalyst. */
export function getDeployableFiles(contents: Record<string, string>): Set<string> {
  return new Set(Object.keys(contents).filter(path => !path.endsWith('/') && contents[path] !== EMPTY_CONTENT_HASH))
}

function sameList(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
  const listA = a ?? []
  const listB = b ?? []
  return listA.length === listB.length && listA.every((x, i) => x === listB[i])
}

function sameSet<T>(a: T[], b: T[]): boolean {
  const setA = new Set(a)
  const setB = new Set(b)
  return setA.size === setB.size && a.every(x => setB.has(x))
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function sameRepresentations(a: ItemRepresentation[], b: ItemRepresentation[]): boolean {
  if (a.length !== b.length) return false
  return a.every((repA, i) => {
    const repB = b[i]
    if (!sameSet(repA.bodyShapes, repB.bodyShapes) || !sameSet(repA.contents, repB.contents)) return false
    if (repA.mainFile !== repB.mainFile) return false
    if (!sameSet(repA.overrideHides ?? [], repB.overrideHides ?? [])) return false
    return sameSet(repA.overrideReplaces ?? [], repB.overrideReplaces ?? [])
  })
}

function sameMetadata(item: Item, metadata: CatalystItemMetadata, deployed: ItemData): boolean {
  if (item.name !== metadata.name || item.description !== metadata.description) return false
  const data = item.data
  if (data.category !== deployed.category || !sameList(data.tags, deployed.tags)) return false
  if (item.type === ItemType.EMOTE) {
    if (data.loop !== deployed.loop) return false
    if (data.outcomes && data.outcomes.length > 0) {
      return sameJson(data.outcomes, deployed.outcomes) && data.randomizeOutcomes === deployed.randomizeOutcomes
    }
    return true
  }
  return (
    sameList(data.hides, deployed.hides) &&
    sameList(data.replaces, deployed.replaces) &&
    sameList(data.removesDefaultHiding, deployed.removesDefaultHiding) &&
    data.blockVrmExport === deployed.blockVrmExport &&
    data.outlineCompatible === deployed.outlineCompatible
  )
}

/** Whether the builder item and its deployed entity carry the same metadata, representations and files. */
export function isItemSynced(item: Item, entity: Entity): boolean {
  const metadata = entity.metadata as CatalystItemMetadata
  const deployed = getEntityItemData(entity)
  // A pre-ADR-74 emote has to be redeployed no matter what.
  if (!deployed || (item.type === ItemType.EMOTE && !metadata.emoteDataADR74)) return false
  if (!sameMetadata(item, metadata, deployed)) return false

  const deployable = getDeployableFiles(item.contents)
  const representations = item.data.representations.map(rep => ({
    ...rep,
    contents: rep.contents.filter(path => deployable.has(path))
  }))
  if (!sameRepresentations(representations, deployed.representations)) return false

  const deployedHashes = new Map((entity.content ?? []).map(({ file, hash }) => [file, hash]))
  for (const path of deployable) {
    // The preview video of a smart wearable never reaches the Catalyst.
    if (path === VIDEO_PATH) continue
    if (deployedHashes.get(path) !== item.contents[path]) return false
  }
  const isSmart = Object.keys(item.contents).some(path => path.endsWith('.js'))
  if (isSmart && item.contents[VIDEO_PATH] !== item.video) return false
  return true
}

type SyncContext = {
  /** The collection has a curation request the committee has not answered yet. */
  isCurationPending: boolean
  /** The curation request has settled; until then an edited item can't tell "unsynced" from "under review". */
  curationLoaded: boolean
  /** The entities request has settled, so a missing entity is really missing rather than still loading. */
  entitiesLoaded: boolean
}

export function getItemSyncStatus(item: Item, entity: Entity | undefined, context: SyncContext): ItemSyncStatus {
  if (!item.isPublished) return ItemSyncStatus.UNPUBLISHED
  if (!context.curationLoaded) return ItemSyncStatus.LOADING
  if (entity) {
    if (isItemSynced(item, entity)) return ItemSyncStatus.SYNCED
    return context.isCurationPending ? ItemSyncStatus.UNDER_REVIEW : ItemSyncStatus.UNSYNCED
  }
  if (!item.isApproved) return ItemSyncStatus.UNDER_REVIEW
  return context.entitiesLoaded ? ItemSyncStatus.UNSYNCED : ItemSyncStatus.LOADING
}

export type ItemSync = {
  status: ItemSyncStatus
  /** The deployed entity, when there is one: what "Reset item" restores. */
  entity?: Entity
}

/** What the item row's Status pill says on a collection approved at least once. */
export enum ItemRowStatus {
  PUBLISHED = 'published',
  MODIFIED = 'modified',
  REJECTED = 'rejected',
  UNDER_REVIEW = 'under_review',
  MISSING = 'missing'
}

/** What the row status needs from the collection's latest review request. */
export type RowStatusCuration = Pick<CollectionCuration, 'status' | 'updatedAt'>

/**
 * Null while the sync is unknown, and for an unapproved item outside a review: the collection pill tells that
 * story. An edited item reads "rejected" when the committee turned the changes down, which only covers edits
 * made before the rejection: a later edit is something the committee never saw. An approved item with no entity
 * is "missing" (its files never reached the Catalyst, so it may not work in-world) unless its collection is under
 * review, which is the way it gets redeployed.
 */
export function getItemRowStatus(
  item: Pick<Item, 'updatedAt'>,
  sync: ItemSync | undefined,
  curation: RowStatusCuration | null | undefined
): ItemRowStatus | null {
  const pending = curation?.status === 'pending'
  const rejected = curation?.status === 'rejected' && item.updatedAt <= curation.updatedAt
  switch (sync?.status) {
    case ItemSyncStatus.SYNCED:
      return ItemRowStatus.PUBLISHED
    case ItemSyncStatus.UNDER_REVIEW:
      return pending ? ItemRowStatus.UNDER_REVIEW : null
    case ItemSyncStatus.UNSYNCED:
      if (sync.entity) return rejected ? ItemRowStatus.REJECTED : ItemRowStatus.MODIFIED
      return pending ? ItemRowStatus.UNDER_REVIEW : ItemRowStatus.MISSING
    default:
      return null
  }
}

/**
 * The Status column exists on collections approved on chain, while some row on the page says more than
 * "published": until then the collection pill already tells the whole story. Approved on chain, not merely
 * reviewed: the rescue step of a first approval already stamps `reviewedAt`, with the deploy still to come.
 */
export function showsItemStatusColumn(collection: Collection, statuses: Iterable<ItemRowStatus | null>): boolean {
  if (!collection.isApproved) return false
  for (const status of statuses) if (status !== null && status !== ItemRowStatus.PUBLISHED) return true
  return false
}

/**
 * The item as deployed: name, description, item data and file hashes taken from the entity, so saving it
 * (with the entity's files re-uploaded) puts the builder copy back in sync.
 */
export function buildResetItem(item: Item, entity: Entity): Item {
  const metadata = entity.metadata as CatalystItemMetadata
  const deployed = getEntityItemData(entity)
  if (!deployed || !entity.content) throw new Error(`Entity ${entity.id} has no item data or content`)
  const contents = Object.fromEntries(entity.content.map(({ file, hash }) => [file, hash]))
  // The preview video and the permission list never reach the Catalyst; keep the builder's. `item.video` is
  // the approved hash, so a video uploaded after approval (pending in `contents`) is discarded with the reset.
  const video = item.video ?? item.contents[VIDEO_PATH]
  if (video) contents[VIDEO_PATH] = video
  const data = item.data.requiredPermissions
    ? { ...deployed, requiredPermissions: item.data.requiredPermissions }
    : deployed
  return { ...item, name: metadata.name, description: metadata.description, data, contents }
}
