import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { fetchCollectionItemPreviews, fetchCollections, getContentsStorageUrl } from './builder'

vi.mock('~/lib/auth', () => ({
  signedFetch: vi.fn()
}))

import { signedFetch } from '~/lib/auth'

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
})

describe('getContentsStorageUrl', () => {
  it('builds the storage URL for a content hash', () => {
    expect(getContentsStorageUrl('Qmx')).toBe('https://builder-api.decentraland.zone/v1/storage/contents/Qmx')
  })
})
