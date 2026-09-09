// Pure state model for the add-items modal: drafts, review/check bookkeeping and completeness
// rules. All async work (file loading, model analysis, thumbnails, upload) lives outside and
// feeds results in through actions, so this reducer stays fully unit-testable.
import { EmoteCategory, WearableCategory } from '@dcl/schemas'
import { checkTriangleCount, type ValidationIssue } from '~/lib/glbValidation'
import { cleanAssetName, isModelFile } from '~/lib/itemFiles'
import { EmotePlayMode, ITEM_NAME_MAX_LENGTH, getSizeError, isValidItemName } from '~/lib/itemFactory'
import { BodyShapeType, ItemType, getMissingBodyShapeType, type Item, type ItemMetrics } from '~/lib/items'
import { type UploadFailureReason } from '~/lib/uploadItems'
import { type AnimationMetrics } from '~/lib/models'
import { DEFAULT_RARITY } from '~/lib/rarities'

const IMAGE_WEARABLE_CATEGORIES = [WearableCategory.EYEBROWS, WearableCategory.EYES, WearableCategory.MOUTH] as string[]

export type DraftStatus = 'processing' | 'ready' | 'failed'

export type ItemDraft = {
  id: string
  fileName: string
  name: string
  status: DraftStatus
  /** i18n key under add_items_modal.file_error when status is 'failed'. */
  errorKey?: string
  errorParams?: Record<string, string | number>
  type: ItemType | null
  contents: Record<string, Blob>
  model: string
  bodyShape: BodyShapeType
  /** True when the zip structure fixed the shape (male/+female/ folders or a manifest). */
  bodyShapeLocked: boolean
  isVariant: boolean
  variantTargetId: string | null
  category: string | null
  rarity: string
  playMode: EmotePlayMode
  /** Data URL of the current thumbnail; also stored as contents['thumbnail.png'] once final. */
  thumbnail: string | null
  thumbnailNotTransparent: boolean
  /** True when we generated the thumbnail (not zip-provided or user-picked), so it can be regenerated. */
  isAutoThumbnail: boolean
  /** Category the auto thumbnail was rendered for; its pose decides whether a category change regenerates it. */
  autoThumbnailCategory: string | null
  metrics: ItemMetrics | null
  emoteMetrics: AnimationMetrics | null
  validationIssues: ValidationIssue[]
  checked: boolean
}

export type AddItemsView = 'details' | 'error'

export type AddItemsState = {
  drafts: ItemDraft[]
  selectedId: string | null
  view: AddItemsView
  failureReason: UploadFailureReason | null
  isUploading: boolean
}

export function createDraft(file: File): ItemDraft {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    name: cleanAssetName(file.name).slice(0, ITEM_NAME_MAX_LENGTH),
    status: 'processing',
    type: null,
    contents: {},
    model: '',
    bodyShape: BodyShapeType.BOTH,
    bodyShapeLocked: false,
    isVariant: false,
    variantTargetId: null,
    category: null,
    rarity: DEFAULT_RARITY,
    playMode: EmotePlayMode.SIMPLE,
    thumbnail: null,
    thumbnailNotTransparent: false,
    isAutoThumbnail: false,
    autoThumbnailCategory: null,
    metrics: null,
    emoteMetrics: null,
    validationIssues: [],
    checked: false
  }
}

export function createInitialState(drafts: ItemDraft[]): AddItemsState {
  return {
    drafts,
    selectedId: drafts[0]?.id ?? null,
    view: 'details',
    failureReason: null,
    isUploading: false
  }
}

export type AddItemsAction =
  | { type: 'draftsAdded'; drafts: ItemDraft[] }
  | { type: 'draftAnalyzed'; id: string; patch: Partial<ItemDraft> }
  | { type: 'draftFailed'; id: string; errorKey: string; errorParams?: Record<string, string | number> }
  | { type: 'draftSelected'; id: string }
  | { type: 'draftRemoved'; id: string }
  | { type: 'draftUpdated'; id: string; patch: Partial<ItemDraft> }
  | { type: 'draftChecked'; id: string }
  | { type: 'uploadStarted' }
  | { type: 'uploadFailed'; failureReason: UploadFailureReason; failedDraftIds: string[] }
  | { type: 'retryRequested' }

/** Re-derives the triangle warning when the category changes (legacy checkTriangleCount rerun). */
function withTriangleRecheck(draft: ItemDraft): ItemDraft {
  if (draft.type !== ItemType.WEARABLE || !draft.metrics || draft.metrics.triangles === undefined) {
    return draft
  }
  const issues = draft.validationIssues.filter(issue => issue.code !== 'TRIANGLE_COUNT_EXCEEDED')
  const triangleIssue = draft.category
    ? checkTriangleCount(draft.metrics.triangles, draft.category as WearableCategory)
    : null
  return { ...draft, validationIssues: triangleIssue ? [...issues, triangleIssue] : issues }
}

function updateDraft(state: AddItemsState, id: string, update: (draft: ItemDraft) => ItemDraft): AddItemsState {
  return { ...state, drafts: state.drafts.map(draft => (draft.id === id ? update(draft) : draft)) }
}

export function addItemsReducer(state: AddItemsState, action: AddItemsAction): AddItemsState {
  switch (action.type) {
    case 'draftsAdded': {
      const drafts = [...state.drafts, ...action.drafts]
      return { ...state, drafts, selectedId: state.selectedId ?? action.drafts[0]?.id ?? null }
    }
    case 'draftAnalyzed':
      return updateDraft(state, action.id, draft => withTriangleRecheck({ ...draft, ...action.patch, status: 'ready' }))
    case 'draftFailed':
      return updateDraft(state, action.id, draft => ({
        ...draft,
        status: 'failed',
        errorKey: action.errorKey,
        errorParams: action.errorParams
      }))
    case 'draftSelected':
      return state.drafts.some(draft => draft.id === action.id) ? { ...state, selectedId: action.id } : state
    case 'draftRemoved': {
      const drafts = state.drafts
        .filter(draft => draft.id !== action.id)
        // A variant pointing at the removed draft loses its target and needs re-review.
        .map(draft =>
          draft.variantTargetId === action.id ? { ...draft, variantTargetId: null, checked: false } : draft
        )
      const selectedId =
        state.selectedId === action.id
          ? (drafts[
              Math.min(
                state.drafts.findIndex(draft => draft.id === action.id),
                drafts.length - 1
              )
            ]?.id ?? null)
          : state.selectedId
      return { ...state, drafts, selectedId }
    }
    case 'draftUpdated':
      // Any edit invalidates a previous review: the draft must be saved (checked) again.
      return updateDraft(state, action.id, draft => withTriangleRecheck({ ...draft, ...action.patch, checked: false }))
    case 'draftChecked': {
      const checkedState = updateDraft(state, action.id, draft => ({ ...draft, checked: true }))
      // SAVE & NEXT advances to the next unchecked draft, wrapping around.
      const index = checkedState.drafts.findIndex(draft => draft.id === action.id)
      const ordered = [...checkedState.drafts.slice(index + 1), ...checkedState.drafts.slice(0, index)]
      const next = ordered.find(draft => !draft.checked)
      return { ...checkedState, selectedId: next?.id ?? action.id }
    }
    case 'uploadStarted':
      return { ...state, isUploading: true }
    case 'uploadFailed': {
      const failed = new Set(action.failedDraftIds)
      const drafts = state.drafts.filter(draft => failed.has(draft.id))
      return {
        ...state,
        drafts,
        selectedId: drafts[0]?.id ?? null,
        view: 'error',
        failureReason: action.failureReason,
        isUploading: false
      }
    }
    case 'retryRequested':
      return { ...state, view: 'details', failureReason: null }
  }
}

export type VariantTargetOption = {
  id: string
  label: string
  /** The body shape the target already has (the variant supplies the other one). */
  bodyShape: BodyShapeType
}

/**
 * Items a single-shape draft can become a representation of: other batch drafts and unpublished
 * collection wearables that are missing exactly the draft's body shape.
 */
export function getVariantTargets(
  draft: ItemDraft,
  drafts: ItemDraft[],
  collectionItems: Item[]
): VariantTargetOption[] {
  if (draft.bodyShape === BodyShapeType.BOTH) return []
  const targetShape = draft.bodyShape === BodyShapeType.MALE ? BodyShapeType.FEMALE : BodyShapeType.MALE

  const draftTargets = drafts
    .filter(
      candidate =>
        candidate.id !== draft.id &&
        candidate.status === 'ready' &&
        candidate.type === ItemType.WEARABLE &&
        !candidate.isVariant &&
        candidate.bodyShape === targetShape &&
        candidate.name.trim().length > 0
    )
    .map(candidate => ({ id: candidate.id, label: candidate.name, bodyShape: candidate.bodyShape }))

  const itemTargets = collectionItems
    .filter(
      item => item.type === ItemType.WEARABLE && !item.isPublished && getMissingBodyShapeType(item) === draft.bodyShape
    )
    .map(item => ({ id: item.id, label: item.name, bodyShape: targetShape }))

  return [...draftTargets, ...itemTargets]
}

/** Wearable made of a plain PNG (eyes / eyebrows / mouth) rather than a 3D model. */
export function isImageWearable(draft: ItemDraft): boolean {
  return draft.type !== ItemType.EMOTE && !Object.keys(draft.contents).some(isModelFile)
}

/** Category choices for the draft: model vs image wearable lists, or emote categories. */
export function getCategoryOptions(draft: ItemDraft): string[] {
  if (draft.type === ItemType.EMOTE) {
    return EmoteCategory.schema.enum as string[]
  }
  if (isImageWearable(draft)) return IMAGE_WEARABLE_CATEGORIES
  return (WearableCategory.schema.enum as string[]).filter(
    category => category !== (WearableCategory.BODY_SHAPE as string) && !IMAGE_WEARABLE_CATEGORIES.includes(category)
  )
}

/** Whether the draft satisfies every requirement to be saved (mirrors legacy validateItemDraft). */
export function isDraftComplete(draft: ItemDraft, drafts: ItemDraft[], collectionItems: Item[]): boolean {
  if (draft.status !== 'ready' || !draft.type || !draft.thumbnail || !draft.metrics) return false
  if (
    draft.type === ItemType.WEARABLE &&
    getSizeError(draft.type, draft.category ?? undefined, draft.contents) !== null
  )
    return false
  if (draft.type === ItemType.EMOTE && getSizeError(draft.type, undefined, draft.contents) !== null) return false

  if (draft.isVariant) {
    if (!draft.variantTargetId) return false
    return getVariantTargets(draft, drafts, collectionItems).some(target => target.id === draft.variantTargetId)
  }

  if (!isValidItemName(draft.name)) return false
  if (!draft.category || !draft.rarity) return false
  return true
}
