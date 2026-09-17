// Wraps draft contents into the blob shapes the WearablePreview iframe accepts, ported from the
// legacy CreateSingleItemModal utils (toWearableWithBlobs / toEmoteWithBlobs).
import {
  BodyShape,
  EmoteCategory,
  Locale,
  PreviewEmote,
  WearableCategory,
  type EmoteDefinition,
  type EmoteWithBlobs,
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
        tags: item.data.tags ?? [],
        loop: !!item.data.loop,
        representations: item.data.representations.map(representation => ({
          bodyShapes: representation.bodyShapes as BodyShape[],
          mainFile: representation.mainFile,
          contents: toContents(representation.contents)
        }))
      }
    } as EmoteDefinition
  }
  return {
    ...base,
    data: {
      ...item.data,
      category: item.data.category as WearableCategory,
      hides: item.data.hides ?? [],
      replaces: item.data.replaces ?? [],
      tags: item.data.tags ?? [],
      representations: item.data.representations.map(representation => ({
        bodyShapes: representation.bodyShapes as BodyShape[],
        mainFile: representation.mainFile,
        contents: toContents(representation.contents),
        overrideHides: representation.overrideHides ?? [],
        overrideReplaces: representation.overrideReplaces ?? []
      }))
    }
  } as WearableDefinition
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
  if (!emoteSubject) {
    options.emote = emote
    // Legacy quirk: the jump animation leaves the frame at the default zoom.
    if (emote === PreviewEmote.JUMP) options.zoom = 1
  }
  return options
}
