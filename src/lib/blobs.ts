/** Byte-wise comparison; skips the read when the sizes already differ. */
export async function blobsAreEqual(a: Blob, b: Blob): Promise<boolean> {
  if (a === b) return true
  if (a.size !== b.size) return false
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
  const v = new Uint8Array(y)
  return new Uint8Array(x).every((byte, i) => byte === v[i])
}

// Blobs, file maps and items serialize to {} in a query key, so each object gets its own id.
const objectIds = new WeakMap<object, number>()
let nextObjectId = 1

/** A number naming this very object, 0 for none: what a query key holds for a value that doesn't serialize. */
export function identityKey(value: object | null | undefined): number {
  if (!value) return 0
  let id = objectIds.get(value)
  if (id === undefined) {
    id = nextObjectId++
    objectIds.set(value, id)
  }
  return id
}
