// Item domain model + wire mapping for builder-server, ported from the legacy builder
// (src/modules/item + lib/api/builder.ts) so both apps read the same API identically.
import { CollectionDisplayStatus } from './collections'

export enum ItemType {
  WEARABLE = 'wearable',
  EMOTE = 'emote'
}

export enum BodyShapeType {
  BOTH = 'both',
  MALE = 'male',
  FEMALE = 'female'
}

const BODY_SHAPE_MALE = 'urn:decentraland:off-chain:base-avatars:BaseMale'
const BODY_SHAPE_FEMALE = 'urn:decentraland:off-chain:base-avatars:BaseFemale'

export type ItemRepresentation = {
  bodyShapes: string[]
  mainFile: string
  contents: string[]
}

// Wearables and emotes share this shape on the wire; emote-only fields are optional extras.
export type ItemData = {
  category?: string
  representations: ItemRepresentation[]
  loop?: boolean
  outcomes?: unknown[]
  randomizeOutcomes?: boolean
}

export type RemoteItem = {
  id: string
  name: string
  description: string
  thumbnail: string
  eth_address: string
  collection_id: string | null
  price: string | null
  beneficiary: string | null
  rarity: string | null
  is_published: boolean
  is_approved: boolean
  in_catalyst: boolean
  type: ItemType
  data: ItemData
  metrics?: { props?: number }
  contents: Record<string, string>
  created_at: string
  updated_at: string
}

export type Item = {
  id: string
  name: string
  description: string
  thumbnail: string
  owner: string
  collectionId?: string
  price?: string
  beneficiary?: string
  rarity?: string
  isPublished: boolean
  isApproved: boolean
  inCatalyst: boolean
  type: ItemType
  data: ItemData
  metrics?: { props?: number }
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
  return item
}

/** All distinct body shapes across an item's representations. */
export function getBodyShapes(item: Item): string[] {
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

/** Same published / under-review / draft derivation as collections, at the item level. */
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

function getItemMetadataType(item: Item): 'w' | 'sw' | 'e' {
  if (item.type === ItemType.EMOTE) return 'e'
  return Object.keys(item.contents).some(path => path.endsWith('.js')) ? 'sw' : 'w'
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
