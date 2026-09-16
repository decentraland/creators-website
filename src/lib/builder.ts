// Thin client for builder-server (the unchanged legacy back end). Requests are signed through the
// lib/auth chokepoint; response bodies are the legacy `{ ok, data }` envelope.
import { config } from '~/config'
import { signedFetch } from '~/lib/auth'
import {
  fromRemoteCollection,
  toCollectionsQueryString,
  toRemoteCollection,
  type Collection,
  type CollectionCuration,
  type FetchCollectionsParams,
  type PaginatedResource,
  type RemoteCollection
} from '~/lib/collections'
import { VIDEO_PATH, fromRemoteItem, toRemoteItem, type Item, type RemoteItem } from '~/lib/items'
import { type BlockchainRarity } from '~/lib/rarities'
import { type RemoteActivityEvent, type RemoteActivityInput } from '~/lib/activity'

export type CollectionItemPreview = {
  id: string
  name: string
  thumbnailUrl: string
  rarity?: string
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

/** The collection's latest curation request: GET /collections/{id}/curation. Empty data when it was never reviewed. */
export async function fetchCollectionCuration(
  address: string,
  collectionId: string
): Promise<CollectionCuration | null> {
  const curation = await request<CollectionCuration | null | undefined>(
    address,
    'GET',
    `/collections/${collectionId}/curation`,
    '',
    undefined,
    false
  )
  return curation ?? null
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
 * same two-step save the legacy builder performs. A smart wearable's preview video goes to
 * POST /items/{id}/videos instead (field name = path), which has its own 250MB cap.
 */
export async function saveItem(address: string, item: Item, blobs: Record<string, Blob>): Promise<Item> {
  const remote = await request<RemoteItem>(address, 'PUT', `/items/${item.id}`, '', { item: toRemoteItem(item) })
  const { [VIDEO_PATH]: video, ...fileBlobs } = blobs
  if (Object.keys(fileBlobs).length > 0) {
    const files = new FormData()
    for (const path in fileBlobs) files.append(item.contents[path], fileBlobs[path])
    await request<unknown>(address, 'POST', `/items/${item.id}/files`, '', files, false)
  }
  if (video) {
    const videos = new FormData()
    videos.append(VIDEO_PATH, video)
    try {
      await request<unknown>(address, 'POST', `/items/${item.id}/videos`, '', videos, false)
    } catch (error) {
      // The PUT already stored the video reference; drop it so the item never points at a file
      // that was not uploaded (it would look complete and pass the publish gate). Best effort:
      // the caller gets the upload error either way.
      const contents = { ...item.contents }
      delete contents[VIDEO_PATH]
      await request<RemoteItem>(address, 'PUT', `/items/${item.id}`, '', {
        item: toRemoteItem({ ...item, video: undefined, contents })
      }).catch(() => undefined)
      throw error
    }
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
      thumbnailUrl: getContentsStorageUrl(item.contents[item.thumbnail]),
      rarity: item.rarity ?? undefined
    }))
}

/** Rarities with their current USD and MANA prices: GET /rarities. Every rarity costs the same. */
export async function fetchRarities(address: string | undefined): Promise<BlockchainRarity[]> {
  return request<BlockchainRarity[]>(address, 'GET', '/rarities')
}

/** Removes a draft item (and its files): DELETE /items/{id}. */
export async function deleteItem(address: string, itemId: string): Promise<void> {
  await request<boolean>(address, 'DELETE', `/items/${itemId}`)
}

const PUBLISH_COLLECTION_TOS_EVENT = 'publish_collection_tos'

/** Records the creator's Terms of Service acceptance for a publication: POST /collections/{id}/tos. */
export async function saveCollectionTOS(address: string, collection: Collection, email: string): Promise<void> {
  await request<unknown>(
    address,
    'POST',
    `/collections/${collection.id}/tos`,
    '',
    { event: PUBLISH_COLLECTION_TOS_EVENT, email, collection_address: collection.contractAddress },
    false
  )
}

/**
 * Starts the one-day publish lock: POST /collections/{id}/lock. Answers the lock timestamp; the
 * body mirrors the legacy client (the server ignores it).
 */
export async function lockCollection(address: string, collectionId: string): Promise<number> {
  const lock = await request<string>(address, 'POST', `/collections/${collectionId}/lock`, '', {
    collection_address: collectionId
  })
  return +new Date(lock)
}

/**
 * Consolidates a published collection with the chain: POST /collections/{id}/publish. builder-server
 * reads the collection from the subgraph and assigns every item its on-chain id; it answers 401
 * while the graph hasn't indexed the transaction yet, so callers retry on that status.
 */
export async function publishCollectionItems(
  address: string,
  collectionId: string
): Promise<{ collection: Collection; items: Item[] }> {
  const result = await request<{ collection: RemoteCollection; items: RemoteItem[] }>(
    address,
    'POST',
    `/collections/${collectionId}/publish`
  )
  return { collection: fromRemoteCollection(result.collection), items: result.items.map(fromRemoteItem) }
}

/** One stored file by hash, from public storage. */
export async function fetchContent(hash: string): Promise<Blob> {
  const response = await fetch(getContentsStorageUrl(hash))
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

/** The signer's transaction log: GET /activity, newest first, in the paginated envelope. */
export async function fetchActivity(
  address: string,
  page: number,
  limit: number
): Promise<PaginatedResource<RemoteActivityEvent>> {
  return request<PaginatedResource<RemoteActivityEvent>>(address, 'GET', '/activity', `?page=${page}&limit=${limit}`)
}

/** Records a transaction the signer just sent: POST /activity. Idempotent per hash. */
export async function recordActivity(address: string, input: RemoteActivityInput): Promise<RemoteActivityEvent> {
  return request<RemoteActivityEvent>(address, 'POST', '/activity', '', input)
}
