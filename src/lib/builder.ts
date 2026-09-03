// Thin client for builder-server (the unchanged legacy back end). Requests are signed through the
// lib/auth chokepoint; response bodies are the legacy `{ ok, data }` envelope.
import { config } from '~/config'
import { signedFetch } from '~/lib/auth'
import {
  fromRemoteCollection,
  toCollectionsQueryString,
  toRemoteCollection,
  type Collection,
  type FetchCollectionsParams,
  type PaginatedResource,
  type RemoteCollection
} from '~/lib/collections'
import { fromRemoteItem, toRemoteItem, type Item, type RemoteItem } from '~/lib/items'

export type CollectionItemPreview = {
  id: string
  name: string
  thumbnailUrl: string
}

/** Carries the HTTP status so callers can tell "no access / gone" from a transient failure. */
export class BuilderServerError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'BuilderServerError'
    this.status = status
  }
}

const baseUrl = () => config.get('BUILDER_SERVER_URL')

export const getContentsStorageUrl = (hash = '') => `${baseUrl()}/storage/contents/${hash}`

async function request<T>(
  address: string | undefined,
  method: string,
  path: string,
  query = '',
  body?: unknown,
  // The file-upload endpoint answers { ok: true } with no data; every other one carries data.
  expectData = true
): Promise<T> {
  const init: RequestInit = { method }
  if (body instanceof FormData) {
    // No Content-Type: the browser sets multipart/form-data with the boundary itself.
    init.body = body
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  const response = await signedFetch(address, baseUrl(), `${path}${query}`, init)
  const parsed = (await response.json().catch(() => {
    throw new BuilderServerError(
      `builder-server returned a non-JSON response: ${method} ${path} (${response.status})`,
      response.status
    )
  })) as { ok?: boolean; data?: T; error?: string }
  if (!response.ok || parsed.ok === false || (expectData && parsed.data === undefined)) {
    throw new BuilderServerError(
      parsed.error ?? `builder-server request failed: ${method} ${path} (${response.status})`,
      response.status
    )
  }
  return parsed.data as T
}

/**
 * The creator's collections: GET /{address}/collections. Always sends page+limit — without both,
 * builder-server answers with a bare array instead of the paginated envelope.
 */
export async function fetchCollections(
  address: string,
  params: FetchCollectionsParams
): Promise<PaginatedResource<Collection>> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const query = toCollectionsQueryString({ ...params, page, limit })
  const remote = await request<PaginatedResource<RemoteCollection>>(address, 'GET', `/${address}/collections`, query)
  return { ...remote, results: remote.results.map(fromRemoteCollection) }
}

/** A single collection: GET /collections/{id}. 401/404 when the signer can't see it. */
export async function fetchCollection(address: string, collectionId: string): Promise<Collection> {
  const remote = await request<RemoteCollection>(address, 'GET', `/collections/${collectionId}`)
  return fromRemoteCollection(remote)
}

/**
 * One page of a collection's items: GET /collections/{id}/items. As with collections, the
 * paginated envelope only comes back when both page and limit are sent.
 */
export async function fetchCollectionItems(
  address: string,
  collectionId: string,
  { page, limit }: { page: number; limit: number }
): Promise<PaginatedResource<Item>> {
  const remote = await request<PaginatedResource<RemoteItem>>(
    address,
    'GET',
    `/collections/${collectionId}/items`,
    `?page=${page}&limit=${limit}`
  )
  return { ...remote, results: remote.results.map(fromRemoteItem) }
}

/** Every item of a collection (bare-array legacy response) — the rename flow re-encodes them all. */
export async function fetchAllCollectionItems(address: string, collectionId: string): Promise<Item[]> {
  const remote = await request<RemoteItem[]>(address, 'GET', `/collections/${collectionId}/items`)
  return remote.map(fromRemoteItem)
}

/**
 * Create or update a collection: PUT /collections/{id} with { collection, data }, where `data` is
 * the ERC721CollectionV2 initialize calldata the server derives the contract address from.
 */
export async function saveCollection(address: string, collection: Collection, data: string): Promise<Collection> {
  const remote = await request<RemoteCollection>(address, 'PUT', `/collections/${collection.id}`, '', {
    collection: toRemoteCollection(collection),
    data
  })
  return fromRemoteCollection(remote)
}

/** Delete an unpublished collection and its items: DELETE /collections/{id} (409 published, 423 locked). */
export async function deleteCollection(address: string, collectionId: string): Promise<void> {
  await request<boolean>(address, 'DELETE', `/collections/${collectionId}`, '', undefined, false)
}

// builder-server statuses that make an item upload permanently un-retriable.
export const COLLECTION_LOCKED_STATUS = 423
export const ALREADY_PUBLISHED_STATUS = 409

/**
 * Create or update an item and upload its files: PUT /items/{id} with the remote item, then
 * POST /items/{id}/files as multipart where each field name is the file's content hash — the
 * same two-step save the legacy builder performs.
 */
export async function saveItem(address: string, item: Item, blobs: Record<string, Blob>): Promise<Item> {
  const remote = await request<RemoteItem>(address, 'PUT', `/items/${item.id}`, '', { item: toRemoteItem(item) })
  if (Object.keys(blobs).length > 0) {
    const formData = new FormData()
    for (const path in blobs) {
      formData.append(item.contents[path], blobs[path])
    }
    await request<unknown>(address, 'POST', `/items/${item.id}/files`, '', formData, false)
  }
  return fromRemoteItem(remote)
}

/**
 * The first items of a collection, for the 2x2 mosaic cover: GET /collections/{id}/items.
 * Same request the legacy CollectionImage makes.
 */
export async function fetchCollectionItemPreviews(
  address: string | undefined,
  collectionId: string,
  limit = 4
): Promise<CollectionItemPreview[]> {
  const { results } = await request<{ results: RemoteItem[] }>(
    address,
    'GET',
    `/collections/${collectionId}/items`,
    `?page=1&limit=${limit}`
  )
  return results
    .filter(item => item.contents[item.thumbnail])
    .map(item => ({
      id: item.id,
      name: item.name,
      thumbnailUrl: getContentsStorageUrl(item.contents[item.thumbnail])
    }))
}
