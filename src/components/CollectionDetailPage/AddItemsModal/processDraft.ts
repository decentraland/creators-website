// Async half of draft creation: file loading + model analysis + manifest prefills. Results are
// dispatched into the pure reducer; WearablePreview-dependent data (wearable metrics, auto
// thumbnails) is filled afterwards by DraftProcessor.
import { WearableCategory } from '@dcl/schemas'
import { blobToDataURL, convertImageIntoWearableThumbnail, dataURLToBlob } from '~/lib/media'
import { EmotePlayMode, ITEM_NAME_MAX_LENGTH } from '~/lib/itemFactory'
import { THUMBNAIL_PATH, isImageFile, loadItemFile } from '~/lib/itemFiles'
import { BodyShapeType, ItemType, type ItemMetrics } from '~/lib/items'
import { analyzeModel } from '~/lib/models'
import { isRarity } from '~/lib/rarities'
import { isAutoThumbnailStale } from '~/lib/thumbnailPose'
import { type ItemDraft } from './AddItemsModal.state'

const IMAGE_WEARABLE_METRICS: ItemMetrics = {
  triangles: 100,
  materials: 1,
  textures: 1,
  meshes: 1,
  bodies: 1,
  entities: 1
}

function sanitizeRarity(rarity: string | undefined): string | null {
  const value = rarity?.toLowerCase()
  return isRarity(value) ? value : null
}

function sanitizePlayMode(playMode: string | undefined): EmotePlayMode | null {
  if (playMode === (EmotePlayMode.LOOP as string)) return EmotePlayMode.LOOP
  if (playMode === (EmotePlayMode.SIMPLE as string)) return EmotePlayMode.SIMPLE
  return null
}

/**
 * Loads and analyzes one dropped file into a draft patch. Throws ItemFileError for user-facing
 * import problems. The returned patch may still lack metrics/thumbnail — DraftProcessor fills
 * those through the WearablePreview iframe.
 */
export async function processDraftFile(file: File): Promise<Partial<ItemDraft>> {
  const loaded = await loadItemFile(file)
  const analysis = await analyzeModel(loaded.model, loaded.contents)

  const patch: Partial<ItemDraft> = {
    contents: loaded.contents,
    model: loaded.model,
    type: analysis.type,
    validationIssues: analysis.validationIssues,
    emoteMetrics: analysis.emoteMetrics ?? null,
    bodyShape: analysis.type === ItemType.EMOTE ? BodyShapeType.BOTH : (loaded.bodyShape ?? BodyShapeType.BOTH),
    bodyShapeLocked: analysis.type === ItemType.EMOTE
  }

  if (analysis.suggestedCategory) {
    patch.category = analysis.suggestedCategory
  }

  if (analysis.type === ItemType.EMOTE && analysis.emoteMetrics) {
    const { sequences, duration, frames, fps, props, additionalArmatures } = analysis.emoteMetrics
    patch.metrics = { sequences, duration, frames, fps, props, additionalArmatures }
  }

  if (loaded.wearable) {
    patch.name = loaded.wearable.name.slice(0, ITEM_NAME_MAX_LENGTH)
    if (loaded.wearable.data.category) patch.category = loaded.wearable.data.category
    const rarity = sanitizeRarity(loaded.wearable.rarity)
    if (rarity) patch.rarity = rarity
  } else if (loaded.emote) {
    if (loaded.emote.name) patch.name = loaded.emote.name.slice(0, ITEM_NAME_MAX_LENGTH)
    if (loaded.emote.category) patch.category = loaded.emote.category
    const rarity = sanitizeRarity(loaded.emote.rarity)
    if (rarity) patch.rarity = rarity
    const playMode = sanitizePlayMode(loaded.emote.play_mode)
    if (playMode) patch.playMode = playMode
  }

  if (isImageFile(loaded.model)) {
    // Image wearables need no 3D render: fixed metrics + canvas-padded thumbnail.
    patch.metrics = IMAGE_WEARABLE_METRICS
    const source = loaded.contents[THUMBNAIL_PATH] ?? loaded.contents[loaded.model]
    const thumbnail = await convertImageIntoWearableThumbnail(
      source,
      (patch.category as WearableCategory | undefined) ?? WearableCategory.EYES
    )
    const thumbnailBlob = dataURLToBlob(thumbnail)
    patch.thumbnail = thumbnail
    if (thumbnailBlob) {
      patch.contents = { ...loaded.contents, [THUMBNAIL_PATH]: thumbnailBlob }
    }
  } else if (loaded.contents[THUMBNAIL_PATH]) {
    // A zip-provided thumbnail wins over the auto screenshot.
    patch.thumbnail = await blobToDataURL(loaded.contents[THUMBNAIL_PATH])
  }

  return patch
}

/** True when the draft still needs metrics or an auto thumbnail (missing, or posed for another category). */
export function needsPreviewData(draft: ItemDraft): boolean {
  if (draft.status !== 'ready' || !draft.type) return false
  if (isImageFile(draft.model)) return false
  return !draft.metrics || !draft.thumbnail || isAutoThumbnailStale(draft)
}

/**
 * Next draft for the DraftProcessor. Switching the processor mid-load throws that load away, so a
 * draft already in flight keeps its turn; otherwise the one on screen goes before the rest.
 */
export function pickPreviewDraft(
  drafts: ItemDraft[],
  selectedId: string | null,
  inFlightId: string | null
): ItemDraft | null {
  const inFlight = drafts.find(draft => draft.id === inFlightId)
  if (inFlight && needsPreviewData(inFlight)) return inFlight
  const selected = drafts.find(draft => draft.id === selectedId)
  if (selected && needsPreviewData(selected)) return selected
  return drafts.find(needsPreviewData) ?? null
}
