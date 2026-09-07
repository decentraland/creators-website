import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import {
  deleteCollection,
  fetchCollectionItemPreviews,
  fetchCollections,
  getContentsStorageUrl,
  saveItem
} from './builder'

vi.mock('~/lib/auth', () => ({
  signedFetch: vi.fn()
}))

import { signedFetch } from '~/lib/auth'
import { ItemType, type Item } from './items'

const signedFetchMock = signedFetch as Mock

const ADDRESS = '0xabc0000000000000000000000000000000000001'

const remoteCollection = {
  id: 'a1b2',
  name: 'Pirate Hats',
  eth_address: ADDRESS,
  salt: null,
  contract_address: null,
  urn: 'urn:decentraland:matic:collections-v2:0xcontract',
  is_published: false,
  is_approved: false,
  minters: [],
  managers: [],
  forum_link: null,
  lock: null,
  reviewed_at: null,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-04-02T10:00:00Z',
  item_count: '3',
  linked_contract_address: null,
  linked_contract_network: null,
  is_mapping_complete: false
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) }
}

function okResponse(data: unknown) {
  return jsonResponse({ ok: true, data })
}

beforeEach(() => {
  signedFetchMock.mockReset()
})

describe('fetchCollections', () => {
  it('requests the paginated creator collections and maps the results', async () => {
    signedFetchMock.mockResolvedValue(
      okResponse({ results: [remoteCollection], total: 1, page: 1, pages: 1, limit: 20 })
    )

    const result = await fetchCollections(ADDRESS, { page: 1, q: 'hat' })

    const [address, baseUrl, path] = signedFetchMock.mock.calls[0] as [string, string, string]
    expect(address).toBe(ADDRESS)
    expect(baseUrl).toBe('https://builder-api.decentraland.zone/v1')
    // page+limit are ALWAYS sent — without both, builder-server answers a bare array.
    expect(path).toBe(`/${ADDRESS}/collections?q=hat&page=1&limit=20`)
    expect(result.total).toBe(1)
    expect(result.results[0]).toMatchObject({ id: 'a1b2', name: 'Pirate Hats', itemCount: 3 })
  })

  it('throws the server error message on a failed response', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: false, error: 'Unauthorized' }, false, 401))
    await expect(fetchCollections(ADDRESS, { page: 1 })).rejects.toThrow('Unauthorized')
  })

  it('throws a descriptive error when the response body is not JSON', async () => {
    signedFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Unexpected token <'))
    })
    await expect(fetchCollections(ADDRESS, { page: 1 })).rejects.toThrow(/non-JSON response/)
  })

  it('throws when a successful envelope carries no data', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    await expect(fetchCollections(ADDRESS, { page: 1 })).rejects.toThrow('builder-server request failed')
  })
})

describe('fetchCollectionItemPreviews', () => {
  it('fetches the first items and resolves their content-addressed thumbnail URLs', async () => {
    signedFetchMock.mockResolvedValue(
      okResponse({
        results: [{ id: 'i1', name: 'Hat', thumbnail: 'thumbnail.png', contents: { 'thumbnail.png': 'Qmhash' } }]
      })
    )

    const previews = await fetchCollectionItemPreviews(ADDRESS, 'a1b2')

    const [, , path] = signedFetchMock.mock.calls[0] as [string, string, string]
    expect(path).toBe('/collections/a1b2/items?page=1&limit=4')
    expect(previews).toEqual([
      { id: 'i1', name: 'Hat', thumbnailUrl: 'https://builder-api.decentraland.zone/v1/storage/contents/Qmhash' }
    ])
  })

  it('drops items whose thumbnail hash is missing from contents', async () => {
    signedFetchMock.mockResolvedValue(
      okResponse({
        results: [
          { id: 'i1', name: 'Hat', thumbnail: 'thumbnail.png', contents: { 'thumbnail.png': 'Qmhash' } },
          { id: 'i2', name: 'Broken', thumbnail: 'thumbnail.png', contents: {} }
        ]
      })
    )

    const previews = await fetchCollectionItemPreviews(ADDRESS, 'a1b2')

    expect(previews.map(p => p.id)).toEqual(['i1'])
  })
})

describe('getContentsStorageUrl', () => {
  it('builds the storage URL for a content hash', () => {
    expect(getContentsStorageUrl('Qmx')).toBe('https://builder-api.decentraland.zone/v1/storage/contents/Qmx')
  })
})

describe('saveItem', () => {
  const remoteItem = {
    id: 'item-1',
    name: 'Hat',
    description: '',
    thumbnail: 'thumbnail.png',
    eth_address: ADDRESS,
    collection_id: 'a1b2',
    price: null,
    beneficiary: null,
    rarity: 'epic',
    is_published: false,
    is_approved: false,
    in_catalyst: false,
    type: 'wearable',
    data: { representations: [] },
    contents: { 'male/model.glb': 'QmModel', 'thumbnail.png': 'QmThumb' },
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z'
  }

  const item: Item = {
    id: 'item-1',
    name: 'Hat',
    description: '',
    thumbnail: 'thumbnail.png',
    owner: ADDRESS,
    collectionId: 'a1b2',
    rarity: 'epic',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: { representations: [] },
    contents: { 'male/model.glb': 'QmModel', 'thumbnail.png': 'QmThumb' },
    createdAt: 1,
    updatedAt: 1
  }

  it('PUTs the item then POSTs its files keyed by content hash', async () => {
    signedFetchMock.mockResolvedValueOnce(okResponse(remoteItem)).mockResolvedValueOnce(jsonResponse({ ok: true }))

    const blobs = { 'male/model.glb': new Blob(['model']), 'thumbnail.png': new Blob(['thumb']) }
    const saved = await saveItem(ADDRESS, item, blobs)

    expect(saved.id).toBe('item-1')
    const [, , putPath, putInit] = signedFetchMock.mock.calls[0] as [string, string, string, RequestInit]
    expect(putPath).toBe('/items/item-1')
    expect(putInit.method).toBe('PUT')
    const putBody = JSON.parse(putInit.body as string) as { item: { eth_address: string; is_published: boolean } }
    expect(putBody.item.eth_address).toBe(ADDRESS)
    expect(putBody.item.is_published).toBe(false)

    const [, , postPath, postInit] = signedFetchMock.mock.calls[1] as [string, string, string, RequestInit]
    expect(postPath).toBe('/items/item-1/files')
    expect(postInit.body).toBeInstanceOf(FormData)
    const formKeys = Array.from((postInit.body as FormData).keys()).sort()
    expect(formKeys).toEqual(['QmModel', 'QmThumb'])
  })

  it('skips the files request when there is nothing to upload', async () => {
    signedFetchMock.mockResolvedValueOnce(okResponse(remoteItem))
    await saveItem(ADDRESS, item, {})
    expect(signedFetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces the server error with its status', async () => {
    signedFetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'locked' }, false, 423))
    await expect(saveItem(ADDRESS, item, {})).rejects.toMatchObject({ status: 423 })
  })
})

describe('deleteCollection', () => {
  beforeEach(() => signedFetchMock.mockReset())

  it('sends a signed DELETE for the collection', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: true, data: true }))
    await deleteCollection(ADDRESS, 'a1b2')
    expect(signedFetchMock).toHaveBeenCalledWith(
      ADDRESS,
      expect.any(String),
      '/collections/a1b2',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('surfaces the server status when the collection can no longer be deleted', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: false, error: 'already published' }, false, 409))
    await expect(deleteCollection(ADDRESS, 'a1b2')).rejects.toMatchObject({ status: 409 })
  })
})
