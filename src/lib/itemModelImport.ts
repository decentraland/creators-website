// "Change file" and "Add representation" for a saved item: the add-items import pipeline (load, analyze)
// applied to one file, then the item to save plus the files to upload for the body shape the creator picked.
import { type WearableCategory } from '@dcl/schemas'
import {
  addRepresentationToItem,
  getKeptRepresentationPaths,
  getSizeError,
  withReplacedModel,
  withReplacedRepresentation,
  type BuiltItem
} from './itemFactory'
import {
  ItemFileError,
  THUMBNAIL_PATH,
  VIDEO_PATH,
  getBodyShapeTypeFromContents,
  isImageFile,
  isModelPath,
  loadItemFile
} from './itemFiles'
import {
  BODY_SHAPE_FEMALE,
  BODY_SHAPE_MALE,
  BodyShapeType,
  IMAGE_WEARABLE_METRICS,
  ItemType,
  getItemBodyShapeType,
  isSmartWearable,
  isSocialEmote,
  type Item,
  type ItemMetrics
} from './items'
import { analyzeModel } from './models'
import { type ValidationIssue } from './validation'
import { getWearableCategoryOptions, isImageWearableContents } from './wearableCategories'

/** A file loaded and analyzed against the item it is meant to update. */
export type LoadedItemModel = {
  /** The file's contents without its thumbnail: a model change never travels with one, the item keeps its own. */
  contents: Record<string, Blob>
  model: string
  type: ItemType
  /** What the file itself says: both for a zip with male/ and female/ folders, one shape from a single folder, null otherwise. */
  fileBodyShape: BodyShapeType | null
  isSmart: boolean
  requiredPermissions: string[]
  /** Emote and texture metrics come from the analysis; a 3D wearable's are null until the preview measures it. */
  metrics: ItemMetrics | null
  validationIssues: ValidationIssue[]
}

export type ModelUpdateMode = 'replace_all' | 'replace_shape' | 'add_representation'

/** Emotes and smart wearables are unisex by nature: the pick is fixed to both shapes. */
export function isBodyShapeLocked(item: Item, loaded: LoadedItemModel | null = null): boolean {
  return item.type === ItemType.EMOTE || isSmartWearable(item) || !!loaded?.isSmart
}

/** What picking a body shape does to this item. */
export function getModelUpdateMode(item: Item, bodyShape: BodyShapeType): ModelUpdateMode {
  if (bodyShape === BodyShapeType.BOTH) return 'replace_all'
  const current = getItemBodyShapeType(item)
  return current === BodyShapeType.BOTH || current === bodyShape ? 'replace_shape' : 'add_representation'
}

/** The pick to start from: a shape fixed by the file, else the shape(s) the item has today. */
export function getDefaultBodyShape(item: Item, loaded: LoadedItemModel): BodyShapeType {
  if (isBodyShapeLocked(item, loaded)) return BodyShapeType.BOTH
  if (loaded.fileBodyShape === BodyShapeType.MALE || loaded.fileBodyShape === BodyShapeType.FEMALE) {
    return loaded.fileBodyShape
  }
  return getItemBodyShapeType(item) ?? BodyShapeType.BOTH
}

/**
 * Loads and analyzes a model file for an existing item. A file of the other item type (wearable ↔ emote)
 * is rejected, and so is any change to a legacy social emote.
 */
export async function loadModelForItem(file: File, item: Item): Promise<LoadedItemModel> {
  // A legacy social emote's startAnimation/outcomes point at clips of its current file and can't be edited here.
  if (isSocialEmote(item)) throw new ItemFileError('emote_social_unsupported')
  const loaded = await loadItemFile(file)
  const contents = { ...loaded.contents }
  delete contents[THUMBNAIL_PATH]
  const analysis = await analyzeModel(
    loaded.model,
    contents,
    item.data.category as WearableCategory | undefined,
    item.data.hides
  )
  if (analysis.type !== item.type) throw new ItemFileError('invalid_model_file_type')

  const metrics: ItemMetrics | null =
    item.type === ItemType.EMOTE
      ? { ...analysis.emoteMetrics }
      : isImageFile(loaded.model)
        ? IMAGE_WEARABLE_METRICS
        : null

  return {
    contents,
    model: loaded.model,
    type: analysis.type,
    fileBodyShape: loaded.scene ? BodyShapeType.BOTH : loaded.bodyShape,
    isSmart: !!loaded.scene,
    requiredPermissions: loaded.scene?.requiredPermissions ?? [],
    metrics,
    validationIssues: analysis.validationIssues
  }
}

function keptRepresentationPaths(item: Item, bodyShape: BodyShapeType): string[] {
  return getKeptRepresentationPaths(item, bodyShape === BodyShapeType.MALE ? BODY_SHAPE_MALE : BODY_SHAPE_FEMALE)
}

/**
 * The files the preview should measure and render for a pick: a zip with both body-shape folders shows
 * the picked folder only (its files unprefixed, shared files alongside); anything else shows as loaded.
 */
export function getPreviewModel(
  loaded: LoadedItemModel,
  bodyShape: BodyShapeType
): { contents: Record<string, Blob>; model: string } {
  if (bodyShape === BodyShapeType.BOTH || getBodyShapeTypeFromContents(loaded.contents) !== BodyShapeType.BOTH) {
    return { contents: loaded.contents, model: loaded.model }
  }
  const folder = `${bodyShape}/`
  const other = `${bodyShape === BodyShapeType.MALE ? BodyShapeType.FEMALE : BodyShapeType.MALE}/`
  const contents: Record<string, Blob> = {}
  for (const [path, blob] of Object.entries(loaded.contents)) {
    if (path.startsWith(other)) continue
    contents[path.startsWith(folder) ? path.slice(folder.length) : path] = blob
  }
  const model = Object.keys(contents).find(isModelPath) ?? loaded.model
  return { contents, model }
}

/**
 * Why a pick can't go through, if anything: a smart zip only replaces the whole item; both shapes share
 * the item's category, and image and model wearables take disjoint ones, so a shape kept next to the new
 * file must be of the same kind.
 */
export function getModelUpdateError(
  loaded: LoadedItemModel,
  item: Item,
  bodyShape: BodyShapeType
): 'representation_category_mismatch' | 'invalid_representation' | null {
  if (item.type !== ItemType.WEARABLE) return null
  const mode = getModelUpdateMode(item, bodyShape)
  // A smart wearable is unisex: its scene can't live under one shape's folder.
  if (loaded.isSmart && mode !== 'replace_all') return 'invalid_representation'
  if (mode === 'add_representation') {
    const category = item.data.category
    return category && !getWearableCategoryOptions(loaded.contents).includes(category)
      ? 'representation_category_mismatch'
      : null
  }
  if (mode === 'replace_shape') {
    const kept = keptRepresentationPaths(item, bodyShape)
    const keptIsImage = isImageWearableContents(Object.fromEntries(kept.map(path => [path, 1])))
    return kept.length > 0 && isImageWearableContents(loaded.contents) !== keptIsImage
      ? 'representation_category_mismatch'
      : null
  }
  return null
}

/** True when the new file can't keep the item's category (model ↔ texture switch), so a new one is needed. */
export function needsNewCategory(loaded: LoadedItemModel, item: Item, bodyShape: BodyShapeType): boolean {
  if (item.type !== ItemType.WEARABLE || !item.data.category) return false
  if (getModelUpdateMode(item, bodyShape) === 'add_representation') return false
  return !getWearableCategoryOptions(loaded.contents).includes(item.data.category)
}

/**
 * The item to save plus the files to upload for a loaded file and the body shape picked: both shapes
 * replaced, one shape's model replaced (the other kept), or a representation added.
 */
export async function buildModelUpdate(
  loaded: LoadedItemModel,
  item: Item,
  bodyShape: BodyShapeType,
  metrics: ItemMetrics
): Promise<BuiltItem> {
  const error = getModelUpdateError(loaded, item, bodyShape)
  if (error) throw new ItemFileError(error)
  const mode = getModelUpdateMode(item, bodyShape)
  const { contents, model } = loaded
  let built: BuiltItem
  if (mode === 'replace_all') {
    // A new smart zip brings its own scene permissions and preview video; a plain file clears both.
    const video = contents[VIDEO_PATH] ?? (loaded.isSmart ? undefined : null)
    built = await withReplacedModel(item, { contents, model, bodyShape: BodyShapeType.BOTH, metrics, video })
    if (item.type === ItemType.WEARABLE) {
      const data = { ...built.item.data }
      delete data.requiredPermissions
      built.item.data = loaded.isSmart ? { ...data, requiredPermissions: loaded.requiredPermissions } : data
    }
  } else if (mode === 'replace_shape' && bodyShape !== BodyShapeType.BOTH) {
    built = await withReplacedRepresentation(item, bodyShape, { contents, model, metrics })
  } else {
    built = await addRepresentationToItem(
      { item },
      {
        id: item.id,
        name: item.name,
        type: item.type,
        bodyShape,
        category: item.data.category ?? '',
        rarity: item.rarity ?? '',
        contents,
        model,
        metrics,
        owner: item.owner,
        collectionId: item.collectionId ?? ''
      }
    )
  }

  const sizeError = getSizeError(item.type, item.data.category, built.blobs)
  if (sizeError !== null) throw new ItemFileError('size_exceeded', { size: sizeError })
  return built
}
