// Catalyst entities of published standard items, ported from the legacy builder (modules/item/export.ts)
// so a curator here deploys byte-identical entities and computes the same content hashes the chain holds.
import { calculateMultipleHashesADR32, calculateMultipleHashesADR32LegacyQmHash, hashV1 } from '@dcl/hashing'
import { EntityType } from '@dcl/schemas'
import { type Collection } from '~/lib/collections'
import { IMAGE_PATH, ItemType, VIDEO_PATH, type Item, type ItemRepresentation } from '~/lib/items'

const THUMBNAIL_PATH = 'thumbnail.png'
const EMPTY_CONTENT_HASH = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const EMPTY_ITEM_METRICS = { triangles: 0, materials: 0, textures: 0, meshes: 0, bodies: 0, entities: 1 }

export type EntityContent = Record<string, string>

/**
 * The files an item deploys: its stored contents minus the smart-wearable preview video, directory
 * entries and empty files, with `image.png` taken from `imageHash` when the item was saved without one.
 */
export function getEntityContent(item: Item, imageHash?: string): EntityContent {
  const contents: EntityContent = { ...item.contents }
  if (!contents[IMAGE_PATH] && imageHash) contents[IMAGE_PATH] = imageHash
  delete contents[VIDEO_PATH]
  return Object.fromEntries(
    Object.entries(contents).filter(([path, hash]) => !path.endsWith('/') && hash !== EMPTY_CONTENT_HASH)
  )
}

function stripRepresentations(representations: ItemRepresentation[], content: EntityContent) {
  return representations.map(representation => ({
    ...representation,
    contents: representation.contents.filter(path => path in content)
  }))
}

/** The entity metadata. Key order is part of the content hash and must never change. */
export function buildItemEntityMetadata(collection: Collection, item: Item, content: EntityContent) {
  if (!collection.contractAddress || !item.tokenId || !item.urn) {
    throw new Error(`Item ${item.id} is not published`)
  }
  const data = item.data
  const representations = stripRepresentations(data.representations, content)
  if (item.type === ItemType.EMOTE) {
    return {
      id: item.urn,
      name: item.name,
      description: item.description,
      collectionAddress: collection.contractAddress,
      rarity: item.rarity,
      i18n: [{ code: 'en', text: item.name }],
      emoteDataADR74: {
        category: data.category,
        representations,
        tags: data.tags,
        loop: data.loop,
        startAnimation: data.startAnimation,
        randomizeOutcomes: data.randomizeOutcomes,
        outcomes: data.outcomes
      },
      image: IMAGE_PATH,
      thumbnail: THUMBNAIL_PATH,
      metrics: EMPTY_ITEM_METRICS
    }
  }
  return {
    id: item.urn,
    name: item.name,
    description: item.description,
    collectionAddress: collection.contractAddress,
    rarity: item.rarity,
    i18n: [{ code: 'en', text: item.name }],
    data: {
      replaces: data.replaces,
      hides: data.hides,
      ...('removesDefaultHiding' in data ? { removesDefaultHiding: data.removesDefaultHiding } : {}),
      tags: data.tags,
      category: data.category,
      representations,
      ...('blockVrmExport' in data ? { blockVrmExport: data.blockVrmExport } : {}),
      ...('outlineCompatible' in data ? { outlineCompatible: data.outlineCompatible } : {}),
      ...(data.springBones ? { springBones: data.springBones } : {})
    },
    image: IMAGE_PATH,
    thumbnail: THUMBNAIL_PATH,
    metrics: item.metrics
  }
}

function toContentList(content: EntityContent) {
  return Object.entries(content).map(([file, hash]) => ({ file, hash }))
}

/** ADR-32 hash of the item as the collection contract stores it; `v0` is the older Qm format some items still carry. */
export async function computeItemContentHash(
  collection: Collection,
  item: Item,
  content: EntityContent,
  version: 'v0' | 'v1' = 'v1'
): Promise<string> {
  const metadata = buildItemEntityMetadata(collection, item, content)
  const hash = version === 'v0' ? calculateMultipleHashesADR32LegacyQmHash : calculateMultipleHashesADR32
  return (await hash(toContentList(content), metadata)).hash
}

export type BuiltEntity = { entityId: string; entityFile: Uint8Array<ArrayBuffer> }

/** The entity file and its id, exactly as dcl-catalyst-client's buildEntity produces them. */
export async function buildItemEntity(
  collection: Collection,
  item: Item,
  content: EntityContent,
  timestamp = Date.now()
): Promise<BuiltEntity> {
  const metadata = buildItemEntityMetadata(collection, item, content)
  const entity = {
    version: 'v3',
    type: item.type === ItemType.EMOTE ? EntityType.EMOTE : EntityType.WEARABLE,
    pointers: [metadata.id],
    timestamp,
    content: toContentList(content),
    metadata
  }
  const entityFile = new TextEncoder().encode(JSON.stringify(entity))
  return { entityId: await hashV1(entityFile), entityFile }
}

export type AuthLink = { type: string; payload: string; signature?: string }

/** The multipart body of POST /content/entities; files already stored on the Catalyst are left out. */
export function buildDeploymentForm(
  entity: BuiltEntity,
  authChain: AuthLink[],
  files: Map<string, Blob>,
  alreadyUploaded: Set<string>
): FormData {
  const form = new FormData()
  form.append('entityId', entity.entityId)
  authChain.forEach((link, index) => {
    form.append(`authChain[${index}][type]`, link.type)
    form.append(`authChain[${index}][payload]`, link.payload)
    if (link.signature !== undefined) form.append(`authChain[${index}][signature]`, link.signature)
  })
  form.append(entity.entityId, new Blob([entity.entityFile]), entity.entityId)
  for (const [hash, blob] of files) {
    if (!alreadyUploaded.has(hash)) form.append(hash, blob, hash)
  }
  return form
}
