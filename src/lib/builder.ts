// Thin client for builder-server (the unchanged legacy back end). Requests are signed through the
// lib/auth chokepoint; response bodies are the legacy `{ ok, data }` envelope.
import { config } from '~/config'
import { signedFetch } from '~/lib/auth'
import {
  fromRemoteCollection,
  toCollectionsQueryString,
  toRemoteCollection,
  type Collection,
  type CollectionStatusCounts,
  type CollectionsList,
  type FetchCollectionsParams,
  type PaginatedResource,
  type RemoteCollection
} from '~/lib/collections'
import {
  fromRemoteCuration,
  toCurationQueryString,
  type CollectionCuration,
  type CurationFilters,
  type CurationRequestStatus,
  type RemoteCollectionCuration
} from '~/lib/curation'
import { VIDEO_PATH, fromRemoteItem, toRemoteItem, tracksVideoOnSave, type Item, type RemoteItem } from '~/lib/items'
import {
  fromRemoteItemCuration,
  type ItemCuration,
  type LinkedItemsQuery,
  type RemoteItemCuration
} from '~/lib/linkedItemStatus'
import { fromRemoteThirdParty, type RemoteThirdParty, type ThirdParty } from '~/lib/thirdParty'
import { type BlockchainRarity } from '~/lib/rarities'

export type CollectionItemPreview = {
  id: string
  name: string
  thumbnailUrl: string
  rarity?: string
}

/** Carries the HTTP status so callers can tell "no access / gone" from a transient failure. */
/** A failure someone must look at: anything but builder-server refusing what was sent (a 4xx the user can fix). */
export function isUnexpectedFailure(error: unknown): boolean {
  return !(error instanceof BuilderServerError && error.status >= 400 && error.status < 500)
}

export class BuilderServerError extends Error {
  status: number
  /** The error envelope's `data`, when the server sent one. */
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'BuilderServerError'
    this.status = status
    this.data = data
  }
}

const baseUrl = () => config.get('BUILDER_SERVER_URL')

const UNPUBLISHED_COLLECTION_STATUS = 409

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
      response.status,
      parsed.data
    )
  }
  return parsed.data as T
}

/**
 * The creator's collections: GET /{address}/collections. Always sends page+limit — without both,
 * builder-server answers with a bare array instead of the paginated envelope.
 */
export async function fetchCollections(address: string, params: FetchCollectionsParams): Promise<CollectionsList> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const query = toCollectionsQueryString({ ...params, page, limit })
  const remote = await request<PaginatedResource<RemoteCollection> & { counts?: CollectionStatusCounts }>(
    address,
    'GET',
    `/${address}/collections`,
    query
  )
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
  const curation = await request<RemoteCollectionCuration | null | undefined>(
    address,
    'GET',
    `/collections/${collectionId}/curation`,
    '',
    undefined,
    false
  )
  return curation ? fromRemoteCuration(curation) : null
}

/** The committee's address list: GET /committee (public). */
export async function fetchCommittee(): Promise<string[]> {
  const accounts = await request<{ address: string }[]>(undefined, 'GET', '/committee')
  return accounts.map(account => account.address.toLowerCase())
}

/** Every published standard collection the committee reviews: GET /collections (committee only). */
export async function fetchCurationCollections(
  address: string,
  filters: CurationFilters
): Promise<PaginatedResource<Collection>> {
  const remote = await request<PaginatedResource<RemoteCollection>>(
    address,
    'GET',
    '/collections',
    toCurationQueryString(filters)
  )
  return { ...remote, results: remote.results.map(fromRemoteCollection) }
}

/** The latest curation request of every collection the signer may see (all of them for the committee). */
export async function fetchCurations(address: string): Promise<CollectionCuration[]> {
  const remote = await request<RemoteCollectionCuration[]>(address, 'GET', '/curations')
  return remote.map(fromRemoteCuration)
}

/**
 * Opens a new review request: POST /collections/{id}/curation. Creators use it to push changes of an
 * approved collection; the committee to assign a collection that was never requested. 400 while one is pending.
 */
export async function pushCollectionCuration(
  address: string,
  collectionId: string,
  assignee?: string | null
): Promise<CollectionCuration> {
  const body = assignee === undefined ? undefined : { curation: { assignee } }
  const remote = await request<RemoteCollectionCuration>(
    address,
    'POST',
    `/collections/${collectionId}/curation`,
    '',
    body
  )
  return fromRemoteCuration(remote)
}

/** Updates the latest request: PATCH /collections/{id}/curation. Status changes and assignees are committee-only. */
export async function updateCollectionCuration(
  address: string,
  collectionId: string,
  curation: { status?: CurationRequestStatus; assignee?: string | null }
): Promise<CollectionCuration> {
  const remote = await request<RemoteCollectionCuration>(
    address,
    'PATCH',
    `/collections/${collectionId}/curation`,
    '',
    {
      curation
    }
  )
  return fromRemoteCuration(remote)
}

/**
 * Opens the collection's forum topic: POST /collections/{id}/post. The server writes the post and saves the link as
 * `forum_link`; 409 when the collection isn't published yet or already has a topic (its link in the error data).
 */
export async function createCollectionForumPost(address: string, collectionId: string): Promise<string> {
  return request<string>(address, 'POST', `/collections/${collectionId}/post`)
}

/** Replies on the collection's forum topic (committee only): POST /collections/{id}/curation/post. */
export async function createCurationForumReply(
  address: string,
  collectionId: string,
  forumPost: { raw: string }
): Promise<void> {
  await request(address, 'POST', `/collections/${collectionId}/curation/post`, '', { forumPost }, false)
}

/**
 * The latest curation of each item of a linked collection: GET /collections/{id}/itemCurations, optionally only
 * for some items (`itemIds[]`, sent in chunks like the legacy builder does).
 */
export async function fetchItemCurations(
  address: string,
  collectionId: string,
  itemIds?: string[]
): Promise<Map<string, ItemCuration>> {
  try {
    const chunks = itemIds ? chunk(itemIds, ITEM_CURATIONS_CHUNK) : [undefined]
    const pages = await Promise.all(
      chunks.map(ids => {
        const query = ids ? `?${new URLSearchParams(ids.map(id => ['itemIds[]', id])).toString()}` : ''
        return request<RemoteItemCuration[]>(address, 'GET', `/collections/${collectionId}/itemCurations`, query)
      })
    )
    return new Map(pages.flat().map(remote => [remote.item_id, fromRemoteItemCuration(remote)]))
  } catch (error) {
    // builder-server answers 409 "Unpublished collection" until an item of the collection has been submitted.
    if (error instanceof BuilderServerError && error.status === UNPUBLISHED_COLLECTION_STATUS) return new Map()
    throw error
  }
}

const ITEM_CURATIONS_CHUNK = 30

function chunk<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < list.length; start += size) chunks.push(list.slice(start, start + size))
  return chunks.length > 0 ? chunks : [[]]
}

/** The latest curation of one linked item: GET /items/{id}/curation (null before its first publish). */
export async function fetchItemCuration(address: string, itemId: string): Promise<ItemCuration | null> {
  try {
    const remote = await request<RemoteItemCuration | null>(
      address,
      'GET',
      `/items/${itemId}/curation`,
      '',
      undefined,
      false
    )
    return remote ? fromRemoteItemCuration(remote) : null
  } catch (error) {
    if (error instanceof BuilderServerError && error.status === UNPUBLISHED_COLLECTION_STATUS) return null
    throw error
  }
}

/** Sends an already-curated linked item's changes for review again: POST /items/{id}/curation (no cheque). */
export async function pushItemCuration(address: string, itemId: string): Promise<ItemCuration> {
  const remote = await request<RemoteItemCuration>(address, 'POST', `/items/${itemId}/curation`)
  return fromRemoteItemCuration(remote)
}

/**
 * Sets a linked item curation's status: PATCH /items/{id}/curation. Creators send `pending` to refresh a pending
 * request with the item's current hash; committee members approve or reject.
 */
export async function updateItemCuration(
  address: string,
  itemId: string,
  status: CurationRequestStatus
): Promise<ItemCuration> {
  const remote = await request<RemoteItemCuration>(address, 'PATCH', `/items/${itemId}/curation`, '', {
    curation: { status }
  })
  return fromRemoteItemCuration(remote)
}

/** A third party: GET /thirdParties/{id}. 404 for an unpublished one the signer doesn't manage. */
export async function fetchThirdParty(address: string, thirdPartyId: string): Promise<ThirdParty> {
  const remote = await request<RemoteThirdParty>(address, 'GET', `/thirdParties/${encodeURIComponent(thirdPartyId)}`)
  return fromRemoteThirdParty(remote)
}

/** Every third party the signer manages (on chain or virtual): GET /thirdParties. */
export async function fetchThirdParties(address: string): Promise<ThirdParty[]> {
  const remote = await request<RemoteThirdParty[]>(address, 'GET', '/thirdParties')
  return remote.map(fromRemoteThirdParty)
}

/**
 * Item slots the third party still has: GET /thirdParties/{id}/slots (bought slots minus items ever submitted).
 * builder-server answers 0 on any internal failure, so 0 is also "unknown".
 */
export async function fetchThirdPartySlots(address: string, thirdPartyId: string): Promise<number> {
  const slots = await request<number>(address, 'GET', `/thirdParties/${encodeURIComponent(thirdPartyId)}/slots`)
  return Number(slots) || 0
}

/** Picks the third party's kind before its first publish: PATCH /thirdParties/{id} (virtual ones only). */
export async function setThirdPartyKind(address: string, thirdPartyId: string, isProgrammatic: boolean): Promise<void> {
  await request<unknown>(
    address,
    'PATCH',
    `/thirdParties/${encodeURIComponent(thirdPartyId)}`,
    '',
    { isProgrammatic },
    false
  )
}

/**
 * Drops the virtual third party once it exists on chain: DELETE /thirdParties/{id}. builder-server answers 400 until
 * the subgraph has indexed the registration, so callers retry on that status.
 */
export async function deleteVirtualThirdParty(address: string, thirdPartyId: string): Promise<void> {
  await request<unknown>(address, 'DELETE', `/thirdParties/${encodeURIComponent(thirdPartyId)}`, '', undefined, false)
}

export type LinkedItemsPage = PaginatedResource<Item>

/**
 * One page of a linked collection's items, server-filtered: GET /collections/{id}/items?page&limit&synced&mappingStatus.
 * Linked collections can hold thousands of items, so they are never fetched whole.
 */
export async function fetchLinkedCollectionItems(
  address: string,
  collectionId: string,
  page: number,
  limit: number,
  filter: LinkedItemsQuery = {}
): Promise<LinkedItemsPage> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (filter.synced !== undefined) query.set('synced', String(filter.synced))
  if (filter.mappingStatus) query.set('mappingStatus', filter.mappingStatus)
  const remote = await request<PaginatedResource<RemoteItem>>(
    address,
    'GET',
    `/collections/${collectionId}/items`,
    `?${query.toString()}`
  )
  return { ...remote, results: remote.results.map(fromRemoteItem) }
}

/** Every item of a linked collection under a filter, page by page: what "Select all" picks across pages. */
export async function fetchAllLinkedCollectionItems(
  address: string,
  collectionId: string,
  filter: LinkedItemsQuery = {},
  limit = 500
): Promise<Item[]> {
  const items: Item[] = []
  for (let page = 1; ; page++) {
    const result = await fetchLinkedCollectionItems(address, collectionId, page, limit, filter)
    items.push(...result.results)
    if (page >= result.pages || result.results.length === 0) return items
  }
}

/** One item as builder-server holds it right now: GET /items/{id}. */
export async function fetchItem(address: string, itemId: string): Promise<Item> {
  return fromRemoteItem(await request<RemoteItem>(address, 'GET', `/items/${itemId}`))
}

/** The linked items waiting for review, every page of them: GET /collections/{id}/items?status=pending. */
export async function fetchPendingLinkedItems(address: string, collectionId: string, limit = 50): Promise<Item[]> {
  const items: Item[] = []
  for (let page = 1; ; page++) {
    const query = `?${new URLSearchParams({ page: String(page), limit: String(limit), status: 'pending' }).toString()}`
    const remote = await request<PaginatedResource<RemoteItem>>(
      address,
      'GET',
      `/collections/${collectionId}/items`,
      query
    )
    items.push(...remote.results.map(fromRemoteItem))
    if (page >= remote.pages || remote.results.length === 0) break
  }
  return items
}

/** The EIP-712 "ConsumeSlots" cheque the creator signs for a publish, as builder-server stores it. */
export type SlotsCheque = { signature: string; qty: number; salt: string }

export type PublishLinkedItemsResult = { collection: Collection; items: Item[]; itemCurations: ItemCuration[] }

/**
 * Submits linked items for review: POST /collections/{id}/publish with the item ids and the signed cheque. One
 * pending item curation per item; 409 when slots are short or a review is already pending.
 */
export async function publishLinkedItems(
  address: string,
  collectionId: string,
  itemIds: string[],
  cheque: SlotsCheque
): Promise<PublishLinkedItemsResult> {
  const result = await request<{
    collection: RemoteCollection
    items: RemoteItem[]
    itemCurations: RemoteItemCuration[]
  }>(address, 'POST', `/collections/${collectionId}/publish`, '', { itemIds, cheque })
  return {
    collection: fromRemoteCollection(result.collection),
    items: result.items.map(fromRemoteItem),
    itemCurations: result.itemCurations.map(fromRemoteItemCuration)
  }
}

const PUBLISH_LINKED_ITEMS_TOS_EVENT = 'publish_third_party_items_tos'

/** Records the creator's Terms of Service acceptance for a linked publish, with the submitted content hashes. */
export async function saveLinkedItemsTOS(
  address: string,
  collection: Collection,
  email: string,
  hashes: string[]
): Promise<void> {
  await request<unknown>(
    address,
    'POST',
    `/collections/${collection.id}/tos`,
    '',
    { event: PUBLISH_LINKED_ITEMS_TOS_EVENT, email, collection_address: collection.id, hashes },
    false
  )
}

/** What the committee needs to approve a linked collection's pending items (committee only). */
export type LinkedApprovalData = {
  cheque: SlotsCheque
  /** The third party's current Merkle root on chain, null before its first approval. */
  root: string | null
  /** The latest curated content hash of every item ever submitted, by item id: the whole tree's leaves. */
  contentHashes: Record<string, string>
  /** Whether the cheque's slots were already consumed on chain (a retry, or a push with no new slots). */
  chequeWasConsumed: boolean
}

/** GET /collections/{id}/approvalData. */
export async function fetchLinkedApprovalData(address: string, collectionId: string): Promise<LinkedApprovalData> {
  const remote = await request<{
    cheque: SlotsCheque
    root: string | null
    content_hashes: Record<string, string>
    chequeWasConsumed: boolean
  }>(address, 'GET', `/collections/${collectionId}/approvalData`)
  return {
    cheque: remote.cheque,
    root: remote.root,
    contentHashes: remote.content_hashes,
    chequeWasConsumed: remote.chequeWasConsumed
  }
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
export type SaveItemOptions = {
  /** The video hash the item had before this save, restored if the new video fails to upload. */
  previousVideo?: string
}

export async function saveItem(
  address: string,
  item: Item,
  blobs: Record<string, Blob>,
  { previousVideo }: SaveItemOptions = {}
): Promise<Item> {
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
      // The PUT already stored the new video hash; point the item back at the video it had so it never
      // references a file that was not uploaded. Callers that know the previous hash pass it; otherwise an
      // approved item keeps its curation-approved video (`item.video`, which the save leaves alone) and an
      // unapproved one, whose `video` already moved to the new hash, drops it. Best effort: the caller gets
      // the upload error either way.
      const previous = previousVideo ?? (tracksVideoOnSave(item) ? undefined : item.video)
      const contents = { ...item.contents }
      if (previous) contents[VIDEO_PATH] = previous
      else delete contents[VIDEO_PATH]
      await request<RemoteItem>(address, 'PUT', `/items/${item.id}`, '', {
        item: toRemoteItem({ ...item, video: previous, contents })
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
