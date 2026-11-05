import { type Item } from '~/lib/items'
import { BuilderServerError, baseUrl } from './transport'

export const getContentsStorageUrl = (hash = '') => `${baseUrl()}/storage/contents/${hash}`

/**
 * A stored file's size in bytes, or 0 when storage doesn't say. The bucket's CORS allows only GET, so this reads the
 * headers of a GET and cancels it before the body downloads.
 */
export async function fetchContentSize(hash: string): Promise<number> {
  const controller = new AbortController()
  // no-cache for the same reason as fetchContent: a cached copy from an <img> has no CORS headers.
  const response = await fetch(getContentsStorageUrl(hash), { cache: 'no-cache', signal: controller.signal })
  controller.abort()
  if (!response.ok) throw new BuilderServerError(`Could not read ${hash} (${response.status})`, response.status)
  return Number(response.headers.get('content-length')) || 0
}

/** One stored file by hash, from public storage. */
export async function fetchContent(hash: string, signal?: AbortSignal): Promise<Blob> {
  // Storage omits `Vary: Origin`, so a file the page already showed in an <img> sits in the HTTP cache without
  // CORS headers and a plain cached fetch of it fails. Revalidating gets a response with them.
  const response = await fetch(getContentsStorageUrl(hash), { signal, cache: 'no-cache' })
  if (!response.ok) {
    await response.body?.cancel()
    throw new BuilderServerError(`Could not download ${hash} (${response.status})`, response.status)
  }
  return response.blob()
}

/** Downloads every file of a saved item from public storage, keyed by path, for the local preview/editor. */
export async function fetchItemContents(item: Item): Promise<Record<string, Blob>> {
  const entries = await Promise.all(
    Object.entries(item.contents).map(async ([path, hash]) => [path, await fetchContent(hash)] as const)
  )
  return Object.fromEntries(entries)
}
