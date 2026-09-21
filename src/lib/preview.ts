// Wraps draft contents into the blob shapes the WearablePreview iframe accepts, ported from the
// legacy CreateSingleItemModal utils (toWearableWithBlobs / toEmoteWithBlobs).
import {
  BodyShape,
  EmoteCategory,
  Locale,
  PreviewEmote,
  WearableCategory,
  type EmoteDataADR74,
  type EmoteDefinition,
  type EmoteWithBlobs,
  type HideableWearableCategory,
  type PreviewOptions,
  type WearableDefinition,
  type WearableWithBlobs
} from '@dcl/schemas'
import { type AvatarAttributes } from './avatar'
import { getContentsStorageUrl } from './builder'
import { isImageFile, isModelFile } from './itemFiles'
import { ItemType, type Item } from './items'

function findMainFile(contents: Record<string, Blob>): string {
  const model = Object.keys(contents).find(isModelFile)
  const image = Object.keys(contents).find(isImageFile)
  const mainFile = model ?? image
  if (!mainFile) throw new Error('No main content for the preview')
  return mainFile
}

// WearablePreview diffs its options with deep-equal, which sees every Blob as equal to any other, so a
// reused iframe only notices a new model when the wrapper carries a distinct `id`.
export function toWearableWithBlobs(contents: Record<string, Blob>, id = 'preview-item'): WearableWithBlobs {
  return {
    id,
    name: '',
    description: '',
    image: '',
    thumbnail: '',
    i18n: [],
    data: {
      category: WearableCategory.HAT,
      hides: [],
      replaces: [],
      removesDefaultHiding: [],
      tags: [],
      representations: [
        {
          bodyShapes: [BodyShape.MALE, BodyShape.FEMALE],
          mainFile: findMainFile(contents),
          contents: Object.entries(contents).map(([key, blob]) => ({ key, blob })),
          overrideHides: [],
          overrideReplaces: []
        }
      ],
      blockVrmExport: false,
      outlineCompatible: true
    }
  }
}

export function toEmoteWithBlobs(contents: Record<string, Blob>, id = 'preview-item'): EmoteWithBlobs {
  return {
    id,
    name: '',
    description: '',
    image: '',
    thumbnail: '',
    i18n: [],
    emoteDataADR74: {
      category: EmoteCategory.DANCE,
      tags: [],
      representations: [
        {
          bodyShapes: [BodyShape.MALE, BodyShape.FEMALE],
          mainFile: findMainFile(contents),
          contents: Object.entries(contents).map(([key, blob]) => ({ key, blob }))
        }
      ],
      loop: false
    }
  }
}

/**
 * A saved item as the definition the preview iframe renders (legacy toWearable / toEmote): every
 * content path resolved to its public storage URL. `id = item.id` so a changed model needs no new id.
 */
export function itemToDefinition(item: Item): WearableDefinition | EmoteDefinition {
  const toContents = (paths: string[]) =>
    paths.map(path => ({ key: path, url: getContentsStorageUrl(item.contents[path]) }))
  const base = {
    id: item.id,
    name: item.name,
    description: item.description,
    thumbnail: item.thumbnail,
    image: item.thumbnail,
    i18n: [{ code: Locale.EN, text: item.name }]
  }
  if (item.type === ItemType.EMOTE) {
    return {
      ...base,
      emoteDataADR74: {
        ...item.data,
        category: item.data.category as EmoteCategory,
        // `Item` keeps social emote data opaque: the editor never edits it, it only passes it through.
        startAnimation: item.data.startAnimation as EmoteDataADR74['startAnimation'],
        outcomes: item.data.outcomes as EmoteDataADR74['outcomes'],
        tags: item.data.tags ?? [],
        loop: !!item.data.loop,
        representations: item.data.representations.map(representation => ({
          bodyShapes: representation.bodyShapes as BodyShape[],
          mainFile: representation.mainFile,
          contents: toContents(representation.contents)
        }))
      }
    } satisfies EmoteDefinition
  }
  return {
    ...base,
    data: {
      ...item.data,
      category: item.data.category as WearableCategory,
      hides: (item.data.hides ?? []) as HideableWearableCategory[],
      replaces: (item.data.replaces ?? []) as HideableWearableCategory[],
      removesDefaultHiding: item.data.removesDefaultHiding as HideableWearableCategory[] | undefined,
      tags: item.data.tags ?? [],
      representations: item.data.representations.map(representation => ({
        bodyShapes: representation.bodyShapes as BodyShape[],
        mainFile: representation.mainFile,
        contents: toContents(representation.contents),
        overrideHides: (representation.overrideHides ?? []) as HideableWearableCategory[],
        overrideReplaces: (representation.overrideReplaces ?? []) as HideableWearableCategory[]
      }))
    }
  } satisfies WearableDefinition
}

/**
 * The `base64` URL/option form of a definition. Non-ASCII is dropped, as the legacy encoder does:
 * wearable-preview decodes with a bare `JSON.parse(atob(base64))`, so UTF-8 bytes smuggled through
 * `btoa` would come back as mojibake. Only display strings (an item's name) can carry them, and the
 * name shown in the editor comes from the item itself, not from the definition.
 */
export function definitionToBase64(definition: WearableDefinition | EmoteDefinition): string {
  return btoa(JSON.stringify(definition).replace(/[^\x20-\x7F]/g, ''))
}

/** What the avatar preview shows: saved items (storage URLs) or one in-memory definition (blobs). */
export type AvatarPreviewSource =
  { kind: 'items'; items: Item[] } | { kind: 'definition'; definition: WearableWithBlobs | EmoteWithBlobs }

/** Whether the preview is showing an emote item, which then owns the animation. */
export function isEmoteSubject(source: AvatarPreviewSource): boolean {
  if (source.kind === 'items') return source.items.some(item => item.type === ItemType.EMOTE)
  return 'emoteDataADR74' in source.definition
}

/**
 * Camera range. wearable-preview frames the avatar between `radius / zoom` (closest) and
 * `wheelZoom ×` that (farthest), starting at `wheelStart`% of the way in — the prop is inverted, so 80
 * means 20% out. Scaling `zoom` by 2 halves the closest radius and `wheelStart: 80` puts the start back
 * at `radius / base zoom`: the legacy framing, with twice the zoom in and three times the zoom out.
 */
export const PREVIEW_ZOOM_SCALE = 2
export const PREVIEW_WHEEL_ZOOM = 6
export const PREVIEW_WHEEL_START = 80
/** wearable-preview's own default; restated because scaling it has to start from a known value. */
const BASE_ZOOM = 1.75
// The jump animation leaves the frame at the default zoom, so it is framed further out (legacy quirk).
const JUMP_ZOOM = 1

/** The zoom for an emote, scaled so the camera keeps the legacy framing with a wider range. */
export function getPreviewZoom(emote: PreviewEmote | undefined): number {
  return (emote === PreviewEmote.JUMP ? JUMP_ZOOM : BASE_ZOOM) * PREVIEW_ZOOM_SCALE
}

/**
 * The full option set the iframe needs to dress and animate the avatar. Sent whole on every change:
 * wearable-preview replaces its overrides with each UPDATE rather than merging them.
 */
export function buildPreviewOptions(
  source: AvatarPreviewSource,
  avatar: AvatarAttributes,
  emote: PreviewEmote
): PreviewOptions {
  const emoteSubject = isEmoteSubject(source)
  const options: PreviewOptions = {
    bodyShape: avatar.bodyShape,
    skin: avatar.skin,
    eyes: avatar.eyes,
    hair: avatar.hair,
    urns: avatar.baseWearableUrns,
    disableDefaultEmotes: emoteSubject
  }
  if (source.kind === 'items') {
    options.base64s = source.items.map(item => definitionToBase64(itemToDefinition(item)))
  } else {
    options.blob = source.definition
  }
  options.zoom = getPreviewZoom(emoteSubject ? undefined : emote)
  if (!emoteSubject) options.emote = emote
  return options
}
