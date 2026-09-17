// "Change file" and "Add representation" for a saved item: the add-items import pipeline (load, analyze,
// validate) applied to one file, producing the item to save plus the files to upload.
import { type WearableCategory } from '@dcl/schemas'
import { addRepresentationToItem, getSizeError, withReplacedModel, type BuiltItem } from './itemFactory'
import { ItemFileError, THUMBNAIL_PATH, getBodyShapeTypeFromContents, loadItemFile } from './itemFiles'
import { BodyShapeType, ItemType, getItemBodyShapeType, type Item, type ItemMetrics } from './items'
import { analyzeModel, getModelMetrics, loadGltf } from './models'

export type ModelImportKind = { kind: 'replace' } | { kind: 'add-representation'; bodyShape: BodyShapeType }

async function readWearableMetrics(model: string, contents: Record<string, Blob>): Promise<ItemMetrics> {
  const mappings = Object.fromEntries(Object.entries(contents).map(([path, blob]) => [path, URL.createObjectURL(blob)]))
  try {
    return getModelMetrics(await loadGltf(mappings[model], mappings))
  } finally {
    Object.values(mappings).forEach(url => URL.revokeObjectURL(url))
  }
}

/**
 * Imports a model file onto an existing item. A file of the other item type (wearable ↔ emote) is
 * rejected; a single representation can't come from a zip with both body-shape folders.
 */
export async function importItemModel(file: File, item: Item, kind: ModelImportKind): Promise<BuiltItem> {
  const loaded = await loadItemFile(file)
  // The thumbnail never travels with a model change: the item keeps its own.
  const contents = { ...loaded.contents }
  delete contents[THUMBNAIL_PATH]
  const analysis = await analyzeModel(
    loaded.model,
    contents,
    item.data.category as WearableCategory | undefined,
    item.data.hides
  )
  if (analysis.type !== item.type) throw new ItemFileError('invalid_model_file_type')

  const metrics: ItemMetrics =
    item.type === ItemType.EMOTE
      ? { ...analysis.emoteMetrics }
      : loaded.model.toLowerCase().endsWith('.png')
        ? (item.metrics ?? {})
        : await readWearableMetrics(loaded.model, contents)

  let built: BuiltItem
  if (kind.kind === 'replace') {
    const bodyShape = getItemBodyShapeType(item) ?? loaded.bodyShape ?? BodyShapeType.BOTH
    built = await withReplacedModel(item, { contents, model: loaded.model, bodyShape, metrics })
  } else {
    if (getBodyShapeTypeFromContents(contents) === BodyShapeType.BOTH) throw new ItemFileError('invalid_representation')
    built = await addRepresentationToItem(
      { item },
      {
        id: item.id,
        name: item.name,
        type: item.type,
        bodyShape: kind.bodyShape,
        category: item.data.category ?? '',
        rarity: item.rarity ?? '',
        contents,
        model: loaded.model,
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
