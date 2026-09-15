// Builds builder-server Items out of reviewed upload drafts, ported from the legacy
// CreateSingleItemModal's createItem/addItemRepresentation + utils (sortContent,
// buildRepresentations) and modules/deployment/contentUtils (computeHashes).
import { hashV1 } from '@dcl/hashing'
import { ethers } from 'ethers'
import {
  BODY_SHAPE_FEMALE,
  BODY_SHAPE_MALE,
  BodyShapeType,
  ItemType,
  getItemBodyShapeType,
  hasSceneCode,
  type Item,
  type ItemMetrics,
  type ItemRepresentation
} from './items'
import {
  IMAGE_PATH,
  ItemFileError,
  MAX_EMOTE_FILE_SIZE,
  MAX_SKIN_FILE_SIZE,
  MAX_SMART_WEARABLE_FILE_SIZE,
  MAX_THUMBNAIL_FILE_SIZE,
  MAX_WEARABLE_FILE_SIZE,
  THUMBNAIL_PATH,
  VIDEO_PATH,
  getBodyShapeTypeFromContents,
  isModelPath,
  toMB
} from './itemFiles'
import { generateCatalystImage } from './media'

export const ITEM_NAME_MAX_LENGTH = 32

// Same rules as collection names: non-empty, ≤32 chars and no ':' (names feed the on-chain metadata).
export function isValidItemName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= ITEM_NAME_MAX_LENGTH && !trimmed.includes(':')
}

export enum EmotePlayMode {
  SIMPLE = 'simple',
  LOOP = 'loop'
}

const UPPER_BODY_CATEGORY = 'upper_body'
const SKIN_CATEGORY = 'skin'
const HANDS_BODY_PART = 'hands'

export type SortedContent = {
  male: Record<string, Blob>
  female: Record<string, Blob>
  all: Record<string, Blob>
}

/** A reviewed draft, ready to become an Item. */
export type ItemDraftPayload = {
  id: string
  name: string
  type: ItemType
  bodyShape: BodyShapeType
  category: string
  rarity: string
  playMode?: EmotePlayMode
  /** Smart wearables only: permissions read from the zip's scene.json. */
  requiredPermissions?: string[]
  /** From wearable.json / emote.json when the zip ships one. */
  description?: string
  tags?: string[]
  blockVrmExport?: boolean
  /** Normalized contents including thumbnail.png (and video.mp4 for a smart wearable); model/texture keys unprefixed unless a BOTH zip. */
  contents: Record<string, Blob>
  /** Main model/texture path within contents. */
  model: string
  metrics: ItemMetrics
  owner: string
  collectionId: string
}

const prefixContentName = (bodyShape: BodyShapeType, contentKey: string): string => `${bodyShape}/${contentKey}`

// Item-level files that are never part of a body-shape representation.
const ROOT_PATHS = new Set([THUMBNAIL_PATH, VIDEO_PATH, IMAGE_PATH])

/** Prefixes every content key with the body shape; the thumbnail, catalyst image and video stay at the root. */
const prefixContents = (bodyShape: BodyShapeType, contents: Record<string, Blob>): Record<string, Blob> => {
  return Object.keys(contents).reduce((newContents: Record<string, Blob>, key: string) => {
    if (ROOT_PATHS.has(key)) {
      return newContents
    }
    newContents[prefixContentName(bodyShape, key)] = contents[key]
    return newContents
  }, {})
}

/**
 * Sorts contents into male / female / all according to the chosen body shape. `all` carries the
 * thumbnail plus both prefixed representations.
 */
export function sortContent(bodyShape: BodyShapeType, contents: Record<string, Blob>): SortedContent {
  const male =
    bodyShape === BodyShapeType.BOTH || bodyShape === BodyShapeType.MALE
      ? prefixContents(BodyShapeType.MALE, contents)
      : {}
  const female =
    bodyShape === BodyShapeType.BOTH || bodyShape === BodyShapeType.FEMALE
      ? prefixContents(BodyShapeType.FEMALE, contents)
      : {}
  return { male, female, all: withRootFiles({ ...male, ...female }, contents) }
}

function withRootFiles(all: Record<string, Blob>, contents: Record<string, Blob>): Record<string, Blob> {
  for (const path of ROOT_PATHS) {
    if (contents[path]) all[path] = contents[path]
  }
  return all
}

/** Variant of sortContent for zips that already ship male/ and female/ folders. */
export function sortContentZipBothBodyShape(bodyShape: BodyShapeType, contents: Record<string, Blob>): SortedContent {
  let male: Record<string, Blob> = {}
  let female: Record<string, Blob> = {}
  const both: Record<string, Blob> = {}

  for (const [key, value] of Object.entries(contents)) {
    if (key.startsWith('male/') && (bodyShape === BodyShapeType.BOTH || bodyShape === BodyShapeType.MALE)) {
      male[key] = value
    } else if (key.startsWith('female/') && (bodyShape === BodyShapeType.BOTH || bodyShape === BodyShapeType.FEMALE)) {
      female[key] = value
    } else {
      both[key] = value
    }
  }

  male = {
    ...male,
    ...(bodyShape === BodyShapeType.BOTH || bodyShape === BodyShapeType.MALE
      ? prefixContents(BodyShapeType.MALE, both)
      : {})
  }
  female = {
    ...female,
    ...(bodyShape === BodyShapeType.BOTH || bodyShape === BodyShapeType.FEMALE
      ? prefixContents(BodyShapeType.FEMALE, both)
      : {})
  }

  return { male, female, all: withRootFiles({ ...male, ...female }, contents) }
}

export function buildRepresentations(
  bodyShape: BodyShapeType,
  model: string,
  contents: SortedContent
): ItemRepresentation[] {
  const representations: ItemRepresentation[] = []

  if (bodyShape === BodyShapeType.MALE || bodyShape === BodyShapeType.BOTH) {
    representations.push({
      bodyShapes: [BODY_SHAPE_MALE],
      mainFile: prefixContentName(BodyShapeType.MALE, model),
      contents: Object.keys(contents.male),
      overrideHides: [],
      overrideReplaces: []
    })
  }

  if (bodyShape === BodyShapeType.FEMALE || bodyShape === BodyShapeType.BOTH) {
    representations.push({
      bodyShapes: [BODY_SHAPE_FEMALE],
      mainFile: prefixContentName(BodyShapeType.FEMALE, model),
      contents: Object.keys(contents.female),
      overrideHides: [],
      overrideReplaces: []
    })
  }

  return representations
}

export function buildRepresentationsZipBothBodyShape(
  bodyShape: BodyShapeType,
  contents: SortedContent
): ItemRepresentation[] {
  const representations: ItemRepresentation[] = []

  if (bodyShape === BodyShapeType.MALE || bodyShape === BodyShapeType.BOTH) {
    const maleMainFile = Object.keys(contents.male).find(isModelPath)
    if (!maleMainFile) throw new ItemFileError('missing_model_file')
    representations.push({
      bodyShapes: [BODY_SHAPE_MALE],
      mainFile: maleMainFile,
      contents: Object.keys(contents.male),
      overrideHides: [],
      overrideReplaces: []
    })
  }

  if (bodyShape === BodyShapeType.FEMALE || bodyShape === BodyShapeType.BOTH) {
    const femaleMainFile = Object.keys(contents.female).find(isModelPath)
    if (!femaleMainFile) throw new ItemFileError('missing_model_file')
    representations.push({
      bodyShapes: [BODY_SHAPE_FEMALE],
      mainFile: femaleMainFile,
      contents: Object.keys(contents.female),
      overrideHides: [],
      overrideReplaces: []
    })
  }

  return representations
}

export async function computeHashes(contents: Record<string, Blob>): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {}
  for (const path in contents) {
    const buffer = await contents[path].arrayBuffer()
    hashes[path] = await hashV1(new Uint8Array(buffer))
  }
  return hashes
}

/**
 * The per-type size cap over the final payload (model + thumbnail, never the video), re-checked
 * at the details step where type and category are known. Returns the violated cap in MB, or null
 * when valid.
 */
export function getSizeError(
  type: ItemType,
  category: string | undefined,
  contents: Record<string, Blob>,
  /** Sizes of already-stored files kept by an update (legacy calculateModelFinalSize). */
  storedSizes: number[] = []
): number | null {
  const totalSize = Object.entries(contents).reduce(
    (total, [path, blob]) => (path === VIDEO_PATH || path === IMAGE_PATH ? total : total + blob.size),
    storedSizes.reduce((total, size) => total + size, 0)
  )
  const maxSize =
    type === ItemType.EMOTE
      ? MAX_EMOTE_FILE_SIZE
      : category === SKIN_CATEGORY
        ? MAX_SKIN_FILE_SIZE
        : hasSceneCode(contents)
          ? MAX_SMART_WEARABLE_FILE_SIZE
          : MAX_WEARABLE_FILE_SIZE
  return totalSize > maxSize ? toMB(maxSize) : null
}

/** Save-time re-check of every cap (legacy sagas): the item cap over model + thumbnail, plus the thumbnail's own. */
export function assertUploadSize(item: Item, blobs: Record<string, Blob>, storedSizes: number[] = []): void {
  const thumbnail = blobs[THUMBNAIL_PATH]
  if (thumbnail && thumbnail.size > MAX_THUMBNAIL_FILE_SIZE) {
    throw new ItemFileError('thumbnail_too_big', { size: toMB(MAX_THUMBNAIL_FILE_SIZE) })
  }
  const size = getSizeError(item.type, item.data.category, blobs, storedSizes)
  if (size !== null) throw new ItemFileError('size_exceeded', { size })
}

/** An item to persist plus the blobs to upload, keyed by content path. */
export type BuiltItem = {
  item: Item
  blobs: Record<string, Blob>
}

/**
 * Builds a brand-new Item from a reviewed draft (legacy createItem): contents are prefixed per
 * body shape and hashed, representations derived, and the item is priced as "not for sale".
 */
export async function buildItem(draft: ItemDraftPayload): Promise<BuiltItem> {
  const isBothZip =
    draft.type === ItemType.WEARABLE && getBodyShapeTypeFromContents(draft.contents) === BodyShapeType.BOTH
  const sorted = isBothZip
    ? sortContentZipBothBodyShape(draft.bodyShape, draft.contents)
    : sortContent(draft.bodyShape, draft.contents)
  const representations = isBothZip
    ? buildRepresentationsZipBothBodyShape(draft.bodyShape, sorted)
    : buildRepresentations(draft.bodyShape, draft.model, sorted)

  const data =
    draft.type === ItemType.WEARABLE
      ? {
          category: draft.category,
          replaces: [],
          hides: [],
          removesDefaultHiding: draft.category === UPPER_BODY_CATEGORY ? [HANDS_BODY_PART] : [],
          tags: draft.tags ?? [],
          representations,
          blockVrmExport: draft.blockVrmExport ?? false,
          outlineCompatible: true,
          // Legacy sends an empty list for every wearable; a smart one carries its scene.json permissions.
          requiredPermissions: draft.requiredPermissions ?? []
        }
      : {
          category: draft.category,
          loop: draft.playMode === EmotePlayMode.LOOP,
          tags: draft.tags ?? [],
          representations
        }

  const now = Date.now()
  const blobs = await withCatalystImage(sorted.all, draft.rarity)
  const contents = await computeHashes(blobs)
  const item: Item = {
    id: draft.id,
    name: draft.name,
    description: draft.description ?? '',
    thumbnail: THUMBNAIL_PATH,
    ...(contents[VIDEO_PATH] ? { video: contents[VIDEO_PATH] } : {}),
    owner: draft.owner,
    collectionId: draft.collectionId,
    totalSupply: 0,
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    rarity: draft.rarity,
    type: draft.type,
    data,
    metrics: draft.metrics,
    contents,
    // "Not for sale" defaults, as the legacy modal saves standard items.
    price: ethers.constants.MaxUint256.toString(),
    beneficiary: draft.owner,
    createdAt: now,
    updatedAt: now
  }

  return { item, blobs }
}

/** Adds the catalyst image next to the thumbnail (legacy generateCatalystImage before every save). */
async function withCatalystImage(blobs: Record<string, Blob>, rarity: string): Promise<Record<string, Blob>> {
  const thumbnail = blobs[THUMBNAIL_PATH]
  if (!thumbnail) return blobs
  return { ...blobs, [IMAGE_PATH]: await generateCatalystImage(thumbnail, rarity) }
}

/**
 * Appends a single-body-shape draft to an existing item as a new representation (legacy
 * addItemRepresentation). The target's thumbnail is kept — the draft's is dropped.
 */
export async function addRepresentationToItem(
  target: BuiltItem | { item: Item; blobs?: Record<string, Blob> },
  draft: ItemDraftPayload
): Promise<BuiltItem> {
  if (draft.bodyShape === BodyShapeType.BOTH) {
    throw new ItemFileError('invalid_representation')
  }
  const targetItem = target.item
  if (
    getItemBodyShapeType(targetItem) !==
    (draft.bodyShape === BodyShapeType.MALE ? BodyShapeType.FEMALE : BodyShapeType.MALE)
  ) {
    throw new ItemFileError('invalid_representation')
  }

  const sorted = sortContent(draft.bodyShape, draft.contents)
  const newBlobs = draft.bodyShape === BodyShapeType.MALE ? sorted.male : sorted.female
  const hashedContents = await computeHashes(newBlobs)
  const representations = buildRepresentations(draft.bodyShape, draft.model, sorted)

  const removesDefaultHiding =
    targetItem.data.category === UPPER_BODY_CATEGORY || (targetItem.data.hides ?? []).includes(UPPER_BODY_CATEGORY)
      ? [HANDS_BODY_PART]
      : targetItem.data.removesDefaultHiding

  const item: Item = {
    ...targetItem,
    data: {
      ...targetItem.data,
      representations: [...targetItem.data.representations, ...representations],
      removesDefaultHiding
    },
    contents: { ...targetItem.contents, ...hashedContents },
    updatedAt: Date.now()
  }

  return { item, blobs: { ...(target.blobs ?? {}), ...newBlobs } }
}

/** Replaces a saved item's thumbnail with a new PNG, hashing it so the file can be uploaded alongside. */
export async function withThumbnail(item: Item, thumbnail: Blob): Promise<BuiltItem> {
  const blobs = await withCatalystImage({ [THUMBNAIL_PATH]: thumbnail }, item.rarity ?? '')
  const hashes = await computeHashes(blobs)
  const contents = { ...item.contents }
  if (item.thumbnail !== THUMBNAIL_PATH) delete contents[item.thumbnail]
  return {
    item: { ...item, thumbnail: THUMBNAIL_PATH, contents: { ...contents, ...hashes }, updatedAt: Date.now() },
    blobs
  }
}

/** Hashes from the legacy CIDv0 algorithm ("Qm…"); Catalyst deployments need the current hashV1. */
export function isOldHash(hash: string): boolean {
  return hash.startsWith('Qm')
}

export function hasOldHashedContents(item: Item): boolean {
  return Object.values(item.contents).some(isOldHash)
}

/**
 * Re-hashes the item's legacy-hashed files with the current algorithm (legacy reHashOlderContents):
 * downloads each of them and returns the item pointing at the new hashes plus the files to re-upload.
 */
export async function withRehashedContents(item: Item, download: (hash: string) => Promise<Blob>): Promise<BuiltItem> {
  const stale = Object.entries(item.contents).filter(([, hash]) => isOldHash(hash))
  const blobs = Object.fromEntries(
    await Promise.all(stale.map(async ([path, hash]) => [path, await download(hash)] as const))
  )
  const hashes = await computeHashes(blobs)
  return { item: { ...item, contents: { ...item.contents, ...hashes }, updatedAt: Date.now() }, blobs }
}
