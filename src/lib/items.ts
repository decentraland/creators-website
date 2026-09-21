// Item domain model + wire mapping for builder-server, ported from the legacy builder
// (src/modules/item + lib/api/builder.ts) so both apps read the same API identically.
import {
  CollectionDisplayStatus,
  canManageCollectionItems,
  canSellCollectionItems,
  hasBeenApproved,
  isCollectionLocked,
  type Collection
} from './collections'
import { type SpringBonesData } from '@dcl/schemas'
import { type ItemListing } from './listings'
import { getRarityMaxSupply } from './rarities'

export enum ItemType {
  WEARABLE = 'wearable',
  EMOTE = 'emote'
}

export enum BodyShapeType {
  BOTH = 'both',
  MALE = 'male',
  FEMALE = 'female'
}

export const BODY_SHAPE_MALE = 'urn:decentraland:off-chain:base-avatars:BaseMale'
export const BODY_SHAPE_FEMALE = 'urn:decentraland:off-chain:base-avatars:BaseFemale'

/** A smart wearable's preview video; stored with the item but never deployed to the Catalyst. */
export const VIDEO_PATH = 'video.mp4'
/** Catalyst image: the thumbnail over its rarity gradient, referenced by every deployed entity. */
export const IMAGE_PATH = 'image.png'

export type ItemRepresentation = {
  bodyShapes: string[]
  mainFile: string
  contents: string[]
  overrideHides?: string[]
  overrideReplaces?: string[]
}

// Wearables and emotes share this shape on the wire; emote-only fields are optional extras.
export type ItemData = {
  category?: string
  representations: ItemRepresentation[]
  hides?: string[]
  replaces?: string[]
  removesDefaultHiding?: string[]
  tags?: string[]
  blockVrmExport?: boolean
  outlineCompatible?: boolean
  /** Smart wearables only: the scene permissions declared in its scene.json. */
  requiredPermissions?: string[]
  /** Spring bone physics per representation GLB, keyed by content hash. */
  springBones?: SpringBonesData | null
  loop?: boolean
  /** Social emotes only: the clips played when the emote starts. Not editable here. */
  startAnimation?: unknown
  outcomes?: unknown[]
  randomizeOutcomes?: boolean
}

// Wearable render stats or emote animation stats, as reported to builder-server.
export type ItemMetrics = {
  triangles?: number
  materials?: number
  textures?: number
  meshes?: number
  bodies?: number
  entities?: number
  sequences?: number
  duration?: number
  frames?: number
  fps?: number
  props?: number
  additionalArmatures?: number
}

export type RemoteItem = {
  id: string
  name: string
  description: string
  thumbnail: string
  video?: string | null
  urn?: string | null
  eth_address: string
  collection_id: string | null
  blockchain_item_id?: string | null
  price: string | null
  beneficiary: string | null
  rarity: string | null
  total_supply?: number | null
  is_published: boolean
  is_approved: boolean
  in_catalyst: boolean
  utility?: string | null
  mappings?: unknown
  type: ItemType
  data: ItemData
  metrics?: ItemMetrics
  contents: Record<string, string>
  content_hash?: string | null
  created_at: string
  updated_at: string
}

export type Item = {
  id: string
  name: string
  description: string
  thumbnail: string
  video?: string
  urn?: string
  owner: string
  collectionId?: string
  price?: string
  beneficiary?: string
  rarity?: string
  /** In-world effect text (≤ 64 chars), wearables only. */
  utility?: string
  totalSupply?: number
  /** On-chain item id (`blockchain_item_id`), assigned once the collection is published. */
  tokenId?: string
  isPublished: boolean
  isApproved: boolean
  inCatalyst: boolean
  type: ItemType
  data: ItemData
  metrics?: ItemMetrics
  contents: Record<string, string>
  createdAt: number
  updatedAt: number
}

export function fromRemoteItem(remote: RemoteItem): Item {
  const item: Item = {
    id: remote.id,
    name: remote.name,
    description: remote.description,
    thumbnail: remote.thumbnail,
    owner: remote.eth_address,
    isPublished: remote.is_published,
    isApproved: remote.is_approved,
    inCatalyst: remote.in_catalyst,
    type: remote.type,
    data: remote.data,
    metrics: remote.metrics,
    contents: remote.contents,
    createdAt: +new Date(remote.created_at),
    updatedAt: +new Date(remote.updated_at)
  }
  if (remote.collection_id) item.collectionId = remote.collection_id
  if (remote.price) item.price = remote.price
  if (remote.beneficiary) item.beneficiary = remote.beneficiary
  if (remote.rarity) item.rarity = remote.rarity
  if (remote.urn) item.urn = remote.urn
  if (remote.video) item.video = remote.video
  if (remote.utility) item.utility = remote.utility
  if (remote.total_supply !== undefined && remote.total_supply !== null) item.totalSupply = remote.total_supply
  if (remote.blockchain_item_id) item.tokenId = remote.blockchain_item_id
  return item
}

/**
 * The wire shape for PUT /items/:id, byte-compatible with the legacy builder's toRemoteItem. Meant for
 * creating/updating draft items only: publication flags are always sent as false, since the server owns them.
 */
export function toRemoteItem(item: Item): Omit<RemoteItem, 'created_at' | 'updated_at' | 'in_catalyst'> {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    thumbnail: item.thumbnail,
    video: item.video || null,
    eth_address: item.owner,
    collection_id: item.collectionId || null,
    blockchain_item_id: item.tokenId || null,
    price: item.price || null,
    urn: item.urn || null,
    beneficiary: item.beneficiary || null,
    rarity: item.rarity || null,
    total_supply: item.totalSupply === undefined ? null : item.totalSupply,
    is_published: false,
    is_approved: false,
    utility: item.utility || null,
    mappings: null,
    type: item.type,
    data: item.data,
    metrics: item.metrics,
    contents: item.contents,
    content_hash: null
  }
}

/** All distinct body shapes across an item's representations. */
function getBodyShapes(item: Item): string[] {
  const bodyShapes = new Set<string>()
  for (const representation of item.data.representations) {
    for (const bodyShape of representation.bodyShapes) bodyShapes.add(bodyShape)
  }
  return Array.from(bodyShapes)
}

/** The Body Type column value: male / female / both (unisex), or null for no representations. */
export function getItemBodyShapeType(item: Item): BodyShapeType | null {
  const bodyShapes = getBodyShapes(item)
  const hasMale = bodyShapes.includes(BODY_SHAPE_MALE)
  const hasFemale = bodyShapes.includes(BODY_SHAPE_FEMALE)
  if (hasMale && hasFemale) return BodyShapeType.BOTH
  if (hasMale) return BodyShapeType.MALE
  if (hasFemale) return BodyShapeType.FEMALE
  return null
}

/** The body shape an item is still missing (male/female), or null when it's already unisex. */
export function getMissingBodyShapeType(item: Item): BodyShapeType | null {
  const bodyShapeType = getItemBodyShapeType(item)
  if (bodyShapeType === BodyShapeType.MALE) return BodyShapeType.FEMALE
  if (bodyShapeType === BodyShapeType.FEMALE) return BodyShapeType.MALE
  return null
}

/** Same published / under-review / draft derivation as collections, at the item level. */
export type ItemSales = {
  minted: number
  maxSupply: number
}

/** Minted vs. maximum supply of a published item; undefined without a rarity. */
export function getItemSales(item: Item): ItemSales | undefined {
  const maxSupply = getRarityMaxSupply(item.rarity)
  if (maxSupply === undefined) return undefined
  return { minted: Math.min(item.totalSupply ?? 0, maxSupply), maxSupply }
}

export function getItemDisplayStatus(item: Item): CollectionDisplayStatus {
  if (!item.isPublished) return CollectionDisplayStatus.DRAFT
  return item.isApproved ? CollectionDisplayStatus.PUBLISHED : CollectionDisplayStatus.UNDER_REVIEW
}

// On-chain metadata string, byte-identical to the legacy builder's getMetadata (modules/item/utils.ts):
// version:type:name:description:category:bodyShapes, plus loop/props/outcome suffixes for emotes.
// It feeds the collection initialize calldata, which the server hashes into the contract address.
export function getItemMetadata(item: Item): string {
  const category = item.data.category
  if (!category) throw new Error(`Item "${item.id}" has no category`)
  // "BaseMale" / "BaseFemale" — the URN suffix.
  const bodyShapeTypes = getBodyShapes(item)
    .map(urn => urn.split(':').pop())
    .join(',')
  const base = `1:${getItemMetadataType(item)}:${item.name}:${item.description}:${category}:${bodyShapeTypes}`
  if (item.type !== ItemType.EMOTE) return base
  const additionalProperties = getEmoteAdditionalProperties(item)
  const outcomeType = getEmoteOutcomeType(item)
  return `${base}:${item.data.loop ? 1 : 0}${additionalProperties ? `:${additionalProperties}` : ''}${
    outcomeType ? `:${outcomeType}` : ''
  }`
}

/**
 * Contents shipping scene code (a `.js` file) make a smart wearable. The same heuristic as the
 * legacy builder and builder-server; older smart wearables carry no scene.json in their contents.
 */
export function isSceneCodeFile(path: string): boolean {
  return path.toLowerCase().endsWith('.js')
}

export function hasSceneCode(contents: Record<string, unknown>): boolean {
  return Object.keys(contents).some(isSceneCodeFile)
}

export function isSmartWearable(item: Item): boolean {
  return item.type === ItemType.WEARABLE && hasSceneCode(item.contents)
}

/**
 * A multi-armature "social" emote (two avatars and/or props). The Unity renderer does not play these,
 * so the preview falls back to Babylon for them, as the legacy builder does.
 */
export function isSocialEmote(item: Item): boolean {
  return item.type === ItemType.EMOTE && (!!item.metrics?.additionalArmatures || item.data.startAnimation !== undefined)
}

/** A smart wearable can't be published until its preview video has been uploaded (legacy isComplete). */
export function isMissingSmartWearableVideo(item: Item): boolean {
  return isSmartWearable(item) && !(VIDEO_PATH in item.contents)
}

function getItemMetadataType(item: Item): 'w' | 'sw' | 'e' {
  if (item.type === ItemType.EMOTE) return 'e'
  return isSmartWearable(item) ? 'sw' : 'w'
}

function getEmoteAdditionalProperties(item: Item): string {
  let properties = ''
  if (Object.keys(item.contents).some(content => content.includes('.mp3'))) properties += 's'
  if ((item.metrics?.props ?? 0) > 0) properties += 'g'
  return properties
}

function getEmoteOutcomeType(item: Item): string {
  const { outcomes, randomizeOutcomes } = item.data
  if (!outcomes || outcomes.length === 0) return ''
  if (outcomes.length === 1) return 'so'
  return randomizeOutcomes ? 'ro' : 'mo'
}

/** The item's creator, or anyone who manages its collection, may edit, move, reset or delete it. */
export function canManageItem(collection: Collection, item: Item, address: string | undefined): boolean {
  if (!address) return false
  return item.owner.toLowerCase() === address.toLowerCase() || canManageCollectionItems(collection, address)
}

/** Name and thumbnail stay editable after publishing (edits go through curation), but not during the publish lock. */
export function canEditItemDetails(collection: Collection, item: Item, address: string | undefined): boolean {
  return canManageItem(collection, item, address) && !isCollectionLocked(collection)
}

/**
 * Only an off-chain order can be re-priced, by whoever may sell (the owner), and only while some
 * supply is left to sell. A legacy CollectionStore price has no `tradeId` and can only be removed.
 */
export function canEditItemPrice(
  collection: Collection,
  item: Item,
  listing: ItemListing | null | undefined,
  address: string | undefined
): listing is ItemListing & { tradeId: string } {
  if (!listing?.tradeId || !hasBeenApproved(collection)) return false
  if (!canSellCollectionItems(collection, address)) return false
  const sales = getItemSales(item)
  return !(sales && sales.minted >= sales.maxSupply)
}
