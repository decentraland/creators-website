import { describe, expect, it } from 'vitest'
import { ImageType, dataURLToBlob, getImageType, isRgbaBackgroundTransparent } from './media'

// 1x1 transparent PNG
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNiYAAAAAkAAxkR2eQAAAAASUVORK5CYII='

describe('dataURLToBlob', () => {
  it('decodes a data URL into a typed blob', () => {
    const blob = dataURLToBlob(PNG_DATA_URL)
    expect(blob).not.toBeNull()
    expect(blob!.type).toBe('image/png')
    expect(blob!.size).toBeGreaterThan(0)
  })

  it('returns null for malformed input', () => {
    expect(dataURLToBlob('not-a-data-url')).toBeNull()
  })
})

describe('getImageType', () => {
  it('detects PNG magic bytes regardless of file name', async () => {
    const blob = dataURLToBlob(PNG_DATA_URL)!
    expect(await getImageType(blob)).toBe(ImageType.PNG)
  })

  it('reports unknown for arbitrary bytes', async () => {
    expect(await getImageType(new Blob([new Uint8Array([1, 2, 3, 4])]))).toBe(ImageType.UNKNOWN)
  })
})

describe('isRgbaBackgroundTransparent', () => {
  function image(width: number, height: number, alpha: (x: number, y: number) => number): Uint8Array {
    const rgba = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        rgba[(y * width + x) * 4 + 3] = alpha(x, y)
      }
    }
    return rgba
  }

  it('accepts an image with a fully transparent border', () => {
    const rgba = image(10, 10, (x, y) => (x === 0 || y === 0 || x === 9 || y === 9 ? 0 : 255))
    expect(isRgbaBackgroundTransparent(rgba, 10, 10)).toBe(true)
  })

  it('rejects an image with an opaque border', () => {
    const rgba = image(10, 10, () => 255)
    expect(isRgbaBackgroundTransparent(rgba, 10, 10)).toBe(false)
  })

  it('treats undecodable/too-small input as transparent (never block on no signal)', () => {
    expect(isRgbaBackgroundTransparent(new Uint8Array(0), 10, 10)).toBe(true)
  })
})
