import { describe, expect, it } from 'vitest'
import { blobsAreEqual, identityKey } from './blobs'

describe('blobsAreEqual', () => {
  it('compares bytes, skipping the read when sizes differ', async () => {
    expect(await blobsAreEqual(new Blob([new Uint8Array([1, 2, 3])]), new Blob([new Uint8Array([1, 2, 3])]))).toBe(true)
    expect(await blobsAreEqual(new Blob([new Uint8Array([1, 2, 3])]), new Blob([new Uint8Array([1, 2, 4])]))).toBe(
      false
    )
    expect(await blobsAreEqual(new Blob([new Uint8Array([1, 2, 3])]), new Blob([new Uint8Array([1, 2])]))).toBe(false)
  })
})

describe('identityKey', () => {
  it('names the same object the same way and different objects differently, even with equal contents', () => {
    const a = new Blob(['x'])
    const b = new Blob(['x'])
    expect(identityKey(a)).toBe(identityKey(a))
    expect(identityKey(a)).not.toBe(identityKey(b))
    expect(identityKey(null)).toBe(0)
  })
})
