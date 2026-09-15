// Image/blob helpers for the add-items flow, ported from the legacy builder's modules/media/utils.
import { WearableCategory } from '@dcl/schemas'

export enum ImageType {
  PNG = 'png',
  GIF = 'gif',
  BMP = 'bmp',
  JPEG = 'jpeg',
  UNKNOWN = 'unknown'
}

export function dataURLToBlob(dataUrl: string): Blob | null {
  const arr = dataUrl.split(',')
  const boxedMime = /:(.*?);/.exec(arr[0])
  if (!boxedMime) return null
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: boxedMime[1] })
}

export async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Decodes a video's metadata; rejects when the browser can't play the file. Chrome defers media
 * loading in hidden tabs, so a stalled decode resolves without a duration instead of hanging.
 */
export function loadVideoMetadata(blob: Blob, timeoutMs = 15000): Promise<{ duration: number | null }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(blob)
    const timer = setTimeout(() => finish({ duration: null }), timeoutMs)
    const finish = (result: { duration: number | null } | Error) => {
      clearTimeout(timer)
      video.removeAttribute('src')
      URL.revokeObjectURL(url)
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish({ duration: video.duration })
    video.onerror = () => finish(new Error('Invalid video'))
    video.src = url
  })
}

/** True type of an image, from its magic bytes — the file extension can lie. */
export async function getImageType(image: Blob): Promise<ImageType> {
  const buffer = await image.arrayBuffer()
  if (buffer.byteLength < 2) return ImageType.UNKNOWN
  const dv = new DataView(buffer, 0, 2)
  const magic = dv.getUint8(0).toString(16) + dv.getUint8(1).toString(16)
  switch (magic) {
    case '8950':
      return ImageType.PNG
    case '4749':
      return ImageType.GIF
    case '424d':
      return ImageType.BMP
    case 'ffd8':
      return ImageType.JPEG
    default:
      return ImageType.UNKNOWN
  }
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const image = new Image()
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not load the image'))
  })
  image.src = await blobToDataURL(blob)
  await loaded
  return image
}

/** Draws the image onto a square canvas of the given size and returns it as a PNG blob. */
export async function resizeImage(blob: Blob, width = 256, height = 256): Promise<Blob> {
  const image = await loadImage(blob)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas context')
  ctx.drawImage(image, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(result => (result ? resolve(result) : reject(new Error('Could not encode the image'))), 'image/png')
  })
}

/**
 * Converts a facial-feature texture (eyes / eyebrows / mouth) into the 1024x1024 thumbnail,
 * padded from the top per category so the texture sits centered in the square.
 */
export async function convertImageIntoWearableThumbnail(
  blob: Blob,
  category: WearableCategory = WearableCategory.EYES
): Promise<string> {
  const image = await loadImage(blob)
  let padding = 128
  switch (category) {
    case WearableCategory.EYEBROWS:
    case WearableCategory.MOUTH:
      padding = 160
      break
    case WearableCategory.EYES:
      padding = 128
      break
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas context')
  ctx.drawImage(image, 0, padding, canvas.width, canvas.height)
  return canvas.toDataURL()
}

/** An alpha value (0-255) at or below this is transparent — slightly above 0 for anti-aliasing dust. */
export const TRANSPARENT_ALPHA_THRESHOLD = 8

/** Fraction of border pixels that must be transparent; logos occasionally bleed into a corner. */
export const TRANSPARENT_BORDER_RATIO = 0.9

/**
 * Whether an RGBA image has a transparent background, judged by sampling its border ring.
 * Marketplaces render the rarity color behind the thumbnail, so an opaque background is the most
 * common thumbnail-related curation rejection. Images too small to sample count as transparent.
 */
export function isRgbaBackgroundTransparent(
  rgba: Uint8Array | Uint8ClampedArray | number[],
  width: number,
  height: number
): boolean {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return true
  }

  const alphaAt = (x: number, y: number): number => rgba[(y * width + x) * 4 + 3]

  let sampled = 0
  let transparent = 0
  const sample = (x: number, y: number): void => {
    sampled++
    if (alphaAt(x, y) <= TRANSPARENT_ALPHA_THRESHOLD) {
      transparent++
    }
  }

  for (let x = 0; x < width; x++) {
    sample(x, 0)
    if (height > 1) sample(x, height - 1)
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y)
    if (width > 1) sample(width - 1, y)
  }

  if (sampled === 0) return true
  return transparent / sampled >= TRANSPARENT_BORDER_RATIO
}

/**
 * Decodes a PNG blob on a canvas and checks the border for transparency. Any decode failure is
 * treated as transparent so the check can never block or wrongly warn on unexpected input.
 */
export async function isPngBackgroundTransparent(blob: Blob): Promise<boolean> {
  try {
    const image = await loadImage(blob)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return true
    ctx.drawImage(image, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return isRgbaBackgroundTransparent(data, canvas.width, canvas.height)
  } catch {
    return true
  }
}
