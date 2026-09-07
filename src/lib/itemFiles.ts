// Single funnel for item file ingestion (drag & drop / browse), ported from the legacy builder's
// ImportStep + @dcl/builder-client loadFile: unzips, reads manifests, normalizes contents and
// detects body shapes. 3D model analysis lives in lib/models; this module is engine-free.
import JSZip from 'jszip'
import { BodyShapeType } from './items'

export const THUMBNAIL_PATH = 'thumbnail.png'

export const ITEM_EXTENSIONS = ['.zip', '.gltf', '.glb', '.png']

export const MAX_THUMBNAIL_FILE_SIZE = 1024 * 1024 // 1MB
export const MAX_WEARABLE_FILE_SIZE = 3 * 1024 * 1024 // 3MB
export const MAX_SKIN_FILE_SIZE = 8 * 1024 * 1024 // 8MB
export const MAX_EMOTE_FILE_SIZE = 3 * 1024 * 1024 // 3MB
export const MAX_EMOTE_DURATION = 10 // seconds

const WEARABLE_MANIFEST = 'wearable.json'
const EMOTE_MANIFEST = 'emote.json'
const SCENE_MANIFEST = 'scene.json'
const BUILDER_MANIFEST = 'builder.json'
const MAX_ZIP_ENTRIES = 500

/** Import failure the UI can translate: `add_items_modal.file_error.{messageKey}`. */
export class ItemFileError extends Error {
  messageKey: string
  messageParams?: Record<string, string | number>

  constructor(messageKey: string, messageParams?: Record<string, string | number>) {
    super(`Item file error: ${messageKey}`)
    this.name = 'ItemFileError'
    this.messageKey = messageKey
    this.messageParams = messageParams
  }
}

export function toMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

export function getExtension(fileName: string): string | null {
  const matches = /\.[0-9a-z]+$/i.exec(fileName)
  return matches ? matches[0].toLowerCase() : null
}

/** "my_cool-hat.glb" → "my cool hat" — the default item name for an uploaded file. */
export function cleanAssetName(fileName: string): string {
  const matches = /(.*)\.(.*)/g.exec(fileName)
  return matches && matches.length ? matches[1].replace(/[.\-_]/g, ' ') : fileName
}

export function isImageFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.png')
}

export function isModelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.gltf') || lower.endsWith('.glb')
}

/** True when the file can be an item's main file (a model, or a non-auxiliary PNG texture). */
export function isModelPath(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) return true
  if (lower.indexOf(THUMBNAIL_PATH) !== -1) return false
  // `_mask.png` also covers `_expressions_mask.png` by construction.
  if (lower.endsWith('_mask.png') || lower.endsWith('_expressions.png')) return false
  return lower.endsWith('.png')
}

export function isExpressionsMaskFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('_expressions_mask.png')
}

export function isExpressionsFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('_expressions.png')
}

export function isMaskFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('_mask.png') && !isExpressionsMaskFile(lower)
}

/**
 * For an auxiliary file (mask / expressions / expressions_mask), the counterpart that must exist:
 * foo_mask.png → foo.png · foo_expressions.png → foo.png · foo_expressions_mask.png → foo_expressions.png.
 * Null when the file isn't auxiliary.
 */
export function getRequiredCounterpartFile(fileName: string): string | null {
  if (isExpressionsMaskFile(fileName)) return fileName.replace(/_expressions_mask\.png$/i, '_expressions.png')
  if (isExpressionsFile(fileName)) return fileName.replace(/_expressions\.png$/i, '.png')
  if (isMaskFile(fileName)) return fileName.replace(/_mask\.png$/i, '.png')
  return null
}

/** Auxiliary PNGs present without their required counterpart (case-insensitive lookup). */
export function findOrphanedAuxiliaryFiles(
  contents: Record<string, unknown>
): Array<{ orphan: string; expected: string }> {
  const keys = Object.keys(contents)
  const lowercaseKeys = new Set(keys.map(key => key.toLowerCase()))
  const orphans: Array<{ orphan: string; expected: string }> = []
  for (const key of keys) {
    const expected = getRequiredCounterpartFile(key)
    if (expected && !lowercaseKeys.has(expected.toLowerCase())) {
      orphans.push({ orphan: key, expected })
    }
  }
  return orphans
}

const BODY_SHAPE_TOP_LEVEL_NAMES = new Set<string>(['male', 'female'])

/**
 * When a creator zipped a folder instead of its files, every entry sits under one wrapper
 * directory. Strip it (recursively) so paths look like a flat zip. Never strips `male`/`female`.
 */
export function stripWrappingFolder(contents: Record<string, Blob>): Record<string, Blob> {
  const meaningfulKeys = Object.keys(contents).filter(key => !key.endsWith('/') && contents[key].size > 0)
  if (meaningfulKeys.length === 0) return contents

  let wrapper: string | null = null
  for (const key of meaningfulKeys) {
    const slashIndex = key.indexOf('/')
    if (slashIndex === -1) return contents
    const topSegment = key.substring(0, slashIndex)
    if (wrapper === null) {
      wrapper = topSegment
    } else if (wrapper !== topSegment) {
      return contents
    }
  }

  if (!wrapper || BODY_SHAPE_TOP_LEVEL_NAMES.has(wrapper.toLowerCase())) {
    return contents
  }

  const prefix = `${wrapper}/`
  const stripped: Record<string, Blob> = {}
  for (const [key, value] of Object.entries(contents)) {
    if (!key.startsWith(prefix)) {
      stripped[key] = value
      continue
    }
    const newKey = key.substring(prefix.length)
    if (newKey) stripped[newKey] = value
  }

  return stripWrappingFolder(stripped)
}

/** Body shape encoded by `male/` / `female/` top-level folders, or null when there are none. */
export function getBodyShapeTypeFromContents(contents: Record<string, unknown>): BodyShapeType | null {
  let hasMale = false
  let hasFemale = false
  for (const key in contents) {
    if (key.startsWith('male/')) hasMale = true
    else if (key.startsWith('female/')) hasFemale = true
  }
  if (hasMale && hasFemale) return BodyShapeType.BOTH
  if (hasMale) return BodyShapeType.MALE
  if (hasFemale) return BodyShapeType.FEMALE
  return null
}

export function getModelFileNameFromSubfolder(modelPath: string): string {
  return modelPath.split('/').pop()!
}

/**
 * Normalizes a zip's body-shape subfolders: empty entries dropped; model/image files flattened to
 * the root for a single body shape, kept prefixed for BOTH (so male/eyes.png ≠ female/eyes.png);
 * everything else (audio, etc.) keeps its path.
 */
export function cleanContentModelKeys(
  contents: Record<string, Blob>,
  bodyShapeType?: BodyShapeType
): Record<string, Blob> {
  return Object.keys(contents).reduce((newContents: Record<string, Blob>, key: string) => {
    if (key.indexOf('/') !== -1) {
      if (contents[key].size === 0) {
        return newContents
      }
      if (isModelFile(key) || isImageFile(key)) {
        const targetKey = bodyShapeType === BodyShapeType.BOTH ? key : getModelFileNameFromSubfolder(key)
        newContents[targetKey] = contents[key]
        return newContents
      }
    }
    newContents[key] = contents[key]
    return newContents
  }, {})
}

/** wearable.json manifest — the subset of the legacy WearableConfig this app reads. */
export type WearableManifest = {
  name: string
  description?: string
  rarity?: string
  data: {
    category?: string
    hides?: string[]
    replaces?: string[]
    tags?: string[]
    representations: Array<{
      bodyShapes: string[]
      mainFile: string
      contents: string[]
      overrideHides?: string[]
      overrideReplaces?: string[]
    }>
  }
}

/** emote.json manifest. */
export type EmoteManifest = {
  name?: string
  description?: string
  rarity?: string
  category?: string
  play_mode?: string
  tags?: string[]
}

export type LoadedItemFile = {
  /** File contents by path, manifests excluded, ready for representation building. */
  contents: Record<string, Blob>
  /** Main model or texture path within contents. */
  model: string
  /** Body shape detected from the zip structure or manifest, when determinable. */
  bodyShape: BodyShapeType | null
  wearable?: WearableManifest
  emote?: EmoteManifest
}

function parseJson(text: string, fileName: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new ItemFileError('invalid_manifest', { fileName })
  }
}

function toWearableManifest(value: unknown): WearableManifest {
  const manifest = value as Partial<WearableManifest> | null
  const representations = manifest?.data?.representations
  if (
    !manifest ||
    typeof manifest.name !== 'string' ||
    !Array.isArray(representations) ||
    representations.length === 0
  ) {
    throw new ItemFileError('invalid_manifest', { fileName: WEARABLE_MANIFEST })
  }
  return manifest as WearableManifest
}

const EMOTE_MANIFEST_STRING_FIELDS = ['name', 'description', 'rarity', 'category', 'play_mode'] as const

function toEmoteManifest(value: unknown): EmoteManifest {
  const manifest = value as Record<string, unknown> | null
  const isValid =
    !!manifest &&
    typeof manifest === 'object' &&
    EMOTE_MANIFEST_STRING_FIELDS.every(field => manifest[field] === undefined || typeof manifest[field] === 'string') &&
    (manifest.tags === undefined ||
      (Array.isArray(manifest.tags) && manifest.tags.every(tag => typeof tag === 'string')))
  if (!isValid) {
    throw new ItemFileError('invalid_manifest', { fileName: EMOTE_MANIFEST })
  }
  return manifest
}

function getManifestBodyShape(wearable: WearableManifest): BodyShapeType {
  const bodyShapes = new Set(wearable.data.representations.flatMap(representation => representation.bodyShapes))
  const hasMale = [...bodyShapes].some(shape => shape.endsWith('BaseMale'))
  const hasFemale = [...bodyShapes].some(shape => shape.endsWith('BaseFemale'))
  if (hasMale && hasFemale) return BodyShapeType.BOTH
  if (hasMale) return BodyShapeType.MALE
  return BodyShapeType.FEMALE
}

async function loadZip(file: File): Promise<LoadedItemFile> {
  // Read fully into memory first to avoid racing jszip's lazy reads.
  const buffer = await file.arrayBuffer()
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new ItemFileError('invalid_zip')
  }

  if (zip.file(SCENE_MANIFEST)) {
    throw new ItemFileError('smart_wearable_not_supported')
  }

  const manifests = new Set([WEARABLE_MANIFEST, EMOTE_MANIFEST, SCENE_MANIFEST, BUILDER_MANIFEST])
  const entries: Array<{ path: string; entry: JSZip.JSZipObject }> = []
  zip.forEach((path, entry) => {
    const base = path.split('/').pop() ?? path
    if (!entry.dir && !base.startsWith('.') && !manifests.has(base)) {
      entries.push({ path, entry })
    }
  })

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new ItemFileError('too_many_files', { max: MAX_ZIP_ENTRIES })
  }

  const blobs = await Promise.all(entries.map(({ entry }) => entry.async('blob')))
  const rawContent: Record<string, Blob> = {}
  entries.forEach(({ path }, index) => {
    if (blobs[index].size > 0) {
      rawContent[path] = blobs[index]
    }
  })

  const thumbnailSize = rawContent[THUMBNAIL_PATH]?.size ?? 0
  if (thumbnailSize > MAX_THUMBNAIL_FILE_SIZE) {
    throw new ItemFileError('thumbnail_too_big', { size: toMB(MAX_THUMBNAIL_FILE_SIZE) })
  }
  const contentsSize = Object.entries(rawContent).reduce(
    (total, [path, blob]) => (path === THUMBNAIL_PATH ? total : total + blob.size),
    0
  )

  const wearableFile = zip.file(WEARABLE_MANIFEST)
  const emoteFile = zip.file(EMOTE_MANIFEST)

  if (wearableFile) {
    const wearable = toWearableManifest(parseJson(await wearableFile.async('text'), WEARABLE_MANIFEST))
    for (const representation of wearable.data.representations) {
      for (const path of [representation.mainFile, ...representation.contents]) {
        if (!rawContent[path]) throw new ItemFileError('manifest_file_missing', { fileName: path })
      }
    }
    const isSkin = wearable.data.category === 'skin'
    const maxSize = isSkin ? MAX_SKIN_FILE_SIZE : MAX_WEARABLE_FILE_SIZE
    if (contentsSize > maxSize) {
      throw new ItemFileError('file_too_big', { size: toMB(maxSize) })
    }
    return {
      contents: rawContent,
      model: wearable.data.representations[0].mainFile,
      bodyShape: getManifestBodyShape(wearable),
      wearable
    }
  }

  if (emoteFile) {
    const emote = toEmoteManifest(parseJson(await emoteFile.async('text'), EMOTE_MANIFEST))
    if (contentsSize > MAX_EMOTE_FILE_SIZE) {
      throw new ItemFileError('file_too_big', { size: toMB(MAX_EMOTE_FILE_SIZE) })
    }
    const model = Object.keys(rawContent).find(isModelPath)
    if (!model) throw new ItemFileError('missing_model_file')
    return { contents: rawContent, model, bodyShape: BodyShapeType.BOTH, emote }
  }

  // No manifest: unwrap a zipped folder, find the main model, normalize body-shape folders.
  const content = stripWrappingFolder(rawContent)
  const model = Object.keys(content).find(isModelPath)
  if (!model) throw new ItemFileError('missing_model_file')

  if (isImageFile(model)) {
    const orphans = findOrphanedAuxiliaryFiles(content)
    if (orphans.length > 0) {
      throw new ItemFileError('orphaned_auxiliary_file', {
        fileName: orphans[0].orphan,
        expected: orphans[0].expected
      })
    }
  }

  // Import-time cap: the most permissive model budget (8MB); the exact per-category/type cap is
  // re-checked at the details step once the type and category are known.
  if (contentsSize > MAX_SKIN_FILE_SIZE) {
    throw new ItemFileError('file_too_big', { size: toMB(MAX_SKIN_FILE_SIZE) })
  }

  const detectedBodyShape = getBodyShapeTypeFromContents(content)
  // Image wearables with no body-shape folders populate both representations from the same files.
  const bodyShape = detectedBodyShape ?? (isImageFile(model) ? BodyShapeType.BOTH : null)

  if (detectedBodyShape === BodyShapeType.BOTH) {
    return { contents: cleanContentModelKeys(content, BodyShapeType.BOTH), model, bodyShape }
  }
  return { contents: cleanContentModelKeys(content), model: getModelFileNameFromSubfolder(model), bodyShape }
}

/**
 * Loads one dropped/browsed file into normalized contents. Zips are unpacked (manifests read),
 * single models/textures become one-file contents. Model analysis (emote detection, metrics,
 * GLB validation) happens separately in lib/models.
 */
export async function loadItemFile(file: File): Promise<LoadedItemFile> {
  const extension = getExtension(file.name)
  if (!extension || !ITEM_EXTENSIONS.includes(extension)) {
    throw new ItemFileError('wrong_extension', { extensions: ITEM_EXTENSIONS.join(', ') })
  }

  if (extension === '.zip') {
    return loadZip(file)
  }

  if (extension === '.png') {
    if (file.size > MAX_WEARABLE_FILE_SIZE) {
      throw new ItemFileError('file_too_big', { size: toMB(MAX_WEARABLE_FILE_SIZE) })
    }
    // A bare texture is an image wearable for both body shapes.
    return { contents: { [file.name]: file }, model: file.name, bodyShape: BodyShapeType.BOTH }
  }

  if (file.size > MAX_SKIN_FILE_SIZE) {
    throw new ItemFileError('file_too_big', { size: toMB(MAX_SKIN_FILE_SIZE) })
  }
  return { contents: { [file.name]: file }, model: file.name, bodyShape: null }
}
