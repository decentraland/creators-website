// The properties form's local draft: a pure reducer over the editable fields of an item plus the
// blobs picked while editing, and the projection back into a saveable Item (legacy RightPanel state).
import { type SpringBonesData, WearableCategory } from '@dcl/schemas'
import { computeHashes, withThumbnail, type BuiltItem } from './itemFactory'
import { VIDEO_PATH } from './itemFiles'
import { ItemType, type Item } from './items'

export const ITEM_DESCRIPTION_MAX_LENGTH = 64
export const ITEM_UTILITY_MAX_LENGTH = 64

const UPPER_BODY = WearableCategory.UPPER_BODY as string
const HANDS = 'hands'

export type ItemDraft = {
  name: string
  description: string
  utility: string
  category: string | null
  rarity: string | null
  hides: string[]
  tags: string[]
  loop: boolean
  blockVrmExport: boolean
  outlineCompatible: boolean
  /** A new thumbnail PNG, uploaded on save. */
  thumbnail: Blob | null
  /** A new smart-wearable preview video, uploaded on save. */
  video: Blob | null
  /** A change-file / add-representation import; its item replaces the saved contents on save. */
  fileUpdate: BuiltItem | null
}

export type ItemDraftAction =
  | { type: 'reset'; item: Item }
  | { type: 'setText'; field: 'name' | 'description' | 'utility'; value: string }
  | { type: 'setCategory'; category: string }
  | { type: 'setRarity'; rarity: string }
  | { type: 'setHides'; hides: string[] }
  | { type: 'setTags'; tags: string[] }
  | { type: 'setLoop'; loop: boolean }
  | { type: 'setFlag'; field: 'blockVrmExport' | 'outlineCompatible'; value: boolean }
  | { type: 'setThumbnail'; thumbnail: Blob | null }
  | { type: 'setVideo'; video: Blob | null }
  | { type: 'setFileUpdate'; update: BuiltItem | null }

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

/** Trimmed, non-empty, de-duplicated tags. */
export function normalizeTags(tags: string[]): string[] {
  return unique(tags.map(tag => tag.trim()).filter(tag => tag.length > 0))
}

/** Legacy items carried a separate `replaces` list; the editor folds it into `hides` on load. */
export function createItemDraft(item: Item): ItemDraft {
  return {
    name: item.name,
    description: item.description,
    utility: item.utility ?? '',
    category: item.data.category ?? null,
    rarity: item.rarity ?? null,
    hides: unique([...(item.data.hides ?? []), ...(item.data.replaces ?? [])]),
    tags: item.data.tags ?? [],
    loop: !!item.data.loop,
    blockVrmExport: item.data.blockVrmExport ?? false,
    outlineCompatible: item.data.outlineCompatible ?? true,
    thumbnail: null,
    video: null,
    fileUpdate: null
  }
}

export function itemDraftReducer(draft: ItemDraft, action: ItemDraftAction): ItemDraft {
  switch (action.type) {
    case 'reset':
      return createItemDraft(action.item)
    case 'setText':
      return { ...draft, [action.field]: action.value }
    case 'setCategory':
      // A skin covers the whole body: nothing is left to hide.
      return {
        ...draft,
        category: action.category,
        hides: action.category === (WearableCategory.SKIN as string) ? [] : draft.hides
      }
    case 'setRarity':
      return { ...draft, rarity: action.rarity }
    case 'setHides':
      return { ...draft, hides: unique(action.hides) }
    case 'setTags':
      return { ...draft, tags: normalizeTags(action.tags) }
    case 'setLoop':
      return { ...draft, loop: action.loop }
    case 'setFlag':
      return { ...draft, [action.field]: action.value }
    case 'setThumbnail':
      return { ...draft, thumbnail: action.thumbnail }
    case 'setVideo':
      return { ...draft, video: action.video }
    case 'setFileUpdate':
      return { ...draft, fileUpdate: action.update }
  }
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/** Whether the draft differs from the item it was created from (in fields or picked files). */
export function isItemDraftDirty(draft: ItemDraft, item: Item): boolean {
  const pristine = createItemDraft(item)
  return (
    draft.name !== pristine.name ||
    draft.description !== pristine.description ||
    draft.utility !== pristine.utility ||
    draft.category !== pristine.category ||
    draft.rarity !== pristine.rarity ||
    !sameList(draft.hides, pristine.hides) ||
    !sameList(draft.tags, pristine.tags) ||
    draft.loop !== pristine.loop ||
    draft.blockVrmExport !== pristine.blockVrmExport ||
    draft.outlineCompatible !== pristine.outlineCompatible ||
    draft.thumbnail !== null ||
    draft.video !== null ||
    draft.fileUpdate !== null
  )
}

/** Upper-body wearables (or anything hiding the upper body) reveal the hands the base avatar hides. */
export function computeRemovesDefaultHiding(category: string | null, hides: string[]): string[] {
  return category === UPPER_BODY || hides.includes(UPPER_BODY) ? [HANDS] : []
}

/**
 * The item with the draft's fields applied, synchronously (no file hashing): what the live preview
 * and validation see while editing. `replaces` is retired into `hides`; every representation mirrors
 * the item-level lists in its overrides.
 */
export function applyDraftToItem(item: Item, draft: ItemDraft): Item {
  const base = draft.fileUpdate?.item ?? item
  const shared = {
    ...base,
    name: draft.name.trim(),
    description: draft.description.trim(),
    rarity: draft.rarity ?? base.rarity
  }
  if (base.type === ItemType.EMOTE) {
    return {
      ...shared,
      data: {
        ...base.data,
        category: draft.category ?? base.data.category,
        tags: draft.tags,
        loop: draft.loop
      }
    }
  }
  const utility = draft.utility.trim()
  const next: Item = {
    ...shared,
    data: {
      ...base.data,
      category: draft.category ?? base.data.category,
      hides: draft.hides,
      replaces: [],
      removesDefaultHiding: computeRemovesDefaultHiding(draft.category, draft.hides),
      tags: draft.tags,
      blockVrmExport: draft.blockVrmExport,
      outlineCompatible: draft.outlineCompatible,
      representations: base.data.representations.map(representation => ({
        ...representation,
        overrideHides: draft.hides,
        overrideReplaces: []
      }))
    }
  }
  if (utility) next.utility = utility
  else delete next.utility
  return next
}

/**
 * The item as the renderer sees it: the draft applied, but the saved display strings kept. Name,
 * description and utility change nothing on screen, and a definition that changes on every keystroke
 * would rebuild the whole scene while typing.
 */
export function toPreviewItem(item: Item, draft: ItemDraft): Item {
  return applyDraftToItem(item, {
    ...draft,
    name: item.name,
    description: item.description,
    utility: item.utility ?? '',
    tags: item.data.tags ?? []
  })
}

/** The preview video may change until the item is approved; after that it is frozen with the deployment. */
export function canUpdateVideo(item: Item): boolean {
  return !item.isPublished || !item.isApproved
}

export type SaveOptions = {
  /** Spring bone params to persist; `undefined` leaves the saved data untouched. */
  springBones?: SpringBonesData | null
}

/** The item to PUT plus the files to upload: fields applied, new thumbnail/video hashed, spring bones merged. */
export async function toSaveableItem(item: Item, draft: ItemDraft, options: SaveOptions = {}): Promise<BuiltItem> {
  let next = applyDraftToItem(item, draft)
  let blobs: Record<string, Blob> = { ...(draft.fileUpdate?.blobs ?? {}) }

  if (draft.thumbnail) {
    const built = await withThumbnail(next, draft.thumbnail)
    next = built.item
    blobs = { ...blobs, ...built.blobs }
  }
  if (draft.video && canUpdateVideo(item)) {
    const { [VIDEO_PATH]: hash } = await computeHashes({ [VIDEO_PATH]: draft.video })
    next = { ...next, video: hash, contents: { ...next.contents, [VIDEO_PATH]: hash } }
    blobs[VIDEO_PATH] = draft.video
  }
  if (options.springBones !== undefined && next.type === ItemType.WEARABLE) {
    next = { ...next, data: { ...next.data, springBones: options.springBones ?? undefined } }
  }
  return { item: { ...next, updatedAt: Date.now() }, blobs }
}
