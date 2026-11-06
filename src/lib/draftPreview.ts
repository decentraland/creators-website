// What the item-file modals (add items, change file) show and measure for one uploaded file, apart from
// the form fields around it.
import { WearableCategory } from '@dcl/schemas'
import { convertImageIntoWearableThumbnail, dataURLToBlob } from './media'
import { THUMBNAIL_PATH, isImageFile } from './itemFiles'
import { type ItemMetrics, type ItemType } from './items'
import { isAutoThumbnailStale } from './thumbnailPose'
import { type ValidationIssue } from './validation'

export type PreviewDraft = {
  id: string
  type: ItemType | null
  contents: Record<string, Blob>
  model: string
  category: string | null
  rarity: string
  isSmart: boolean
  requiredPermissions: string[]
  metrics: ItemMetrics | null
  /** Data URL of the current thumbnail; also stored as contents['thumbnail.png'] once final. */
  thumbnail: string | null
  /** True when we generated the thumbnail (not zip-provided or user-picked), so it can be regenerated. */
  isAutoThumbnail: boolean
  /** Category the auto thumbnail was rendered for; its pose decides whether a category change regenerates it. */
  autoThumbnailCategory: string | null
  validationIssues: ValidationIssue[]
}

/** True when the draft still needs metrics or an auto thumbnail (missing, or posed for another category). */
export function needsPreviewData(draft: PreviewDraft): boolean {
  if (!draft.type) return false
  if (isImageFile(draft.model)) return false
  return !draft.metrics || !draft.thumbnail || isAutoThumbnailStale(draft)
}

/** Canvas-padded thumbnail for an image wearable (legacy updateThumbnailByCategory). */
export async function imageThumbnailPatch(
  contents: Record<string, Blob>,
  model: string,
  category: string | null
): Promise<Pick<PreviewDraft, 'thumbnail' | 'contents'>> {
  const source = contents[THUMBNAIL_PATH] ?? contents[model]
  const thumbnail = await convertImageIntoWearableThumbnail(
    source,
    (category as WearableCategory | null) ?? WearableCategory.EYES
  )
  const thumbnailBlob = dataURLToBlob(thumbnail)
  return { thumbnail, contents: thumbnailBlob ? { ...contents, [THUMBNAIL_PATH]: thumbnailBlob } : contents }
}
