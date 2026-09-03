// Wraps draft contents into the blob shapes the WearablePreview iframe accepts, ported from the
// legacy CreateSingleItemModal utils (toWearableWithBlobs / toEmoteWithBlobs).
import { BodyShape, EmoteCategory, WearableCategory, type EmoteWithBlobs, type WearableWithBlobs } from '@dcl/schemas'
import { isImageFile, isModelFile } from './itemFiles'

function findMainFile(contents: Record<string, Blob>): string {
  const model = Object.keys(contents).find(isModelFile)
  const image = Object.keys(contents).find(isImageFile)
  const mainFile = model ?? image
  if (!mainFile) throw new Error('No main content for the preview')
  return mainFile
}

export function toWearableWithBlobs(contents: Record<string, Blob>): WearableWithBlobs {
  return {
    id: 'preview-item',
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

export function toEmoteWithBlobs(contents: Record<string, Blob>): EmoteWithBlobs {
  return {
    id: 'preview-item',
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
