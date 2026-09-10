// Whether a published item still matches the entity deployed to the Catalyst — the version the world
// and the marketplace show. Ported from the legacy builder (modules/item/utils areSynced + the
// getStatusForStandard selector) so both apps judge the same item the same way.
import { type Entity } from '@dcl/schemas'
import { ItemType, type Item, type ItemData, type ItemRepresentation } from './items'

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
const VIDEO_PATH = 'video.mp4'

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

function getDeployableFiles(contents: Record<string, string>): Set<string> {
  return new Set(Object.keys(contents).filter(path => !path.endsWith('/') && contents[path] !== EMPTY_CONTENT_HASH))
}

function sameList(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
  return (a ?? []).toString() === (b ?? []).toString()
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
    if (repA.overrideHides && repB.overrideHides && repA.overrideReplaces && repB.overrideReplaces) {
      return sameSet(repA.overrideHides, repB.overrideHides) && sameSet(repA.overrideReplaces, repB.overrideReplaces)
    }
    return true
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
  /** The entities request has settled, so a missing entity is really missing rather than still loading. */
  entitiesLoaded: boolean
}

export function getItemSyncStatus(item: Item, entity: Entity | undefined, context: SyncContext): ItemSyncStatus {
  if (entity) {
    if (isItemSynced(item, entity)) return ItemSyncStatus.SYNCED
    return context.isCurationPending ? ItemSyncStatus.UNDER_REVIEW : ItemSyncStatus.UNSYNCED
  }
  if (!item.isPublished) return ItemSyncStatus.UNPUBLISHED
  if (!item.isApproved) return ItemSyncStatus.UNDER_REVIEW
  return context.entitiesLoaded ? ItemSyncStatus.UNSYNCED : ItemSyncStatus.LOADING
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
  return { ...item, name: metadata.name, description: metadata.description, data: deployed, contents }
}
