// Thin client for builder-server (the unchanged legacy back end). Requests are signed through the
// lib/auth chokepoint; response bodies are the legacy `{ ok, data }` envelope.
import { config } from '~/config'
import { signedFetch } from '~/lib/auth'
import {
  fromRemoteCollection,
  toCollectionsQueryString,
  type Collection,
  type FetchCollectionsParams,
  type PaginatedResource,
  type RemoteCollection
} from '~/lib/collections'

export type RemoteItem = {
  id: string
  name: string
  thumbnail: string
  contents: Record<string, string>
}

export type CollectionItemPreview = {
  id: string
  name: string
  thumbnailUrl: string
}

const baseUrl = () => config.get('BUILDER_SERVER_URL')

export const getContentsStorageUrl = (hash = '') => `${baseUrl()}/storage/contents/${hash}`

async function request<T>(address: string | undefined, method: string, path: string, query = ''): Promise<T> {
  const response = await signedFetch(address, baseUrl(), `${path}${query}`, { method })
  const body = (await response.json().catch((err: Error) => {
    throw new Error(
      `builder-server returned a non-JSON response: ${method} ${path} (${response.status}): ${err.message}`
    )
  })) as { ok?: boolean; data?: T; error?: string }
  if (!response.ok || body.ok === false || body.data === undefined) {
    throw new Error(body.error ?? `builder-server request failed: ${method} ${path} (${response.status})`)
  }
  return body.data
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
  return results.map(item => ({
    id: item.id,
    name: item.name,
    thumbnailUrl: getContentsStorageUrl(item.contents[item.thumbnail])
  }))
}
