import {
  fromRemoteCuration,
  toCurationQueryString,
  type CollectionCuration,
  type CurationFilters,
  type CurationRequestStatus,
  type RemoteCollectionCuration
} from '~/lib/curation'
import { fromRemoteCollection, type Collection, type PaginatedResource, type RemoteCollection } from '~/lib/collections'
import { fromRemoteItemCuration, type ItemCuration, type RemoteItemCuration } from '~/lib/linkedItemStatus'
import { type RejectReasonCode } from '~/lib/events'
import { BuilderServerError, UNPUBLISHED_COLLECTION_STATUS, request } from './transport'
import { toValidationLimitError } from './review'

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
  try {
    const remote = await request<RemoteCollectionCuration>(
      address,
      'POST',
      `/collections/${collectionId}/curation`,
      '',
      body
    )
    return fromRemoteCuration(remote)
  } catch (error) {
    // A creator's changes wait for the day's automatic reviews like a retry does.
    throw toValidationLimitError(error)
  }
}

export type CurationUpdate = {
  status?: CurationRequestStatus
  assignee?: string | null
  rejectionReasons?: RejectReasonCode[]
  rejectionMessage?: string
}

/** Updates the latest request: PATCH /collections/{id}/curation. Status changes and assignees are committee-only. */
export async function updateCollectionCuration(
  address: string,
  collectionId: string,
  curation: CurationUpdate
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
