import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MarketplaceServerError,
  fetchCollectionListings,
  isFreeListing,
  toFreeListing,
  toItemListing
} from './listings'

const CONTRACT = '0x00000000000000000000000000000000000000cc'
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const credits = { itemId: '0', tokenId: null, priceCredits: 500, available: 85, source: 'native' as const }
const mana = {
  itemId: '1',
  tokenId: null,
  priceCredits: 12,
  available: 10,
  source: 'legacy' as const,
  manaWei: '5000000000000000000'
}
const paidItem = { itemId: '0', price: '50000000000000000000', isOnSale: true, available: 85 }
const freeItem = { itemId: '2', price: '0', isOnSale: true, available: 40 }
const notOnSale = { itemId: '3', price: '0', isOnSale: false, available: 100 }

function mockServer(catalog: unknown, items: unknown) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/v3/catalog/unified') ? jsonResponse(catalog) : jsonResponse(items))
  )
}

afterEach(() => fetchMock.mockReset())

describe('fetchCollectionListings', () => {
  it('asks the unified catalog for the collection primaries and keys them by item id', async () => {
    mockServer({ data: [credits, mana], total: 2 }, { data: [paidItem] })
    const listings = await fetchCollectionListings(CONTRACT)

    const urls = fetchMock.mock.calls.map(call => new URL(call[0] as string))
    const catalog = urls.find(url => url.pathname === '/v3/catalog/unified')!
    expect(catalog.origin).toBe('https://marketplace-api.decentraland.zone')
    expect(catalog.searchParams.get('contractAddress')).toBe(CONTRACT)
    expect(catalog.searchParams.get('listingType')).toBe('primary')
    expect(urls.find(url => url.pathname === '/v1/items')!.searchParams.get('contractAddress')).toBe(CONTRACT)

    expect(listings.get('0')).toEqual({
      itemId: '0',
      currency: 'credits',
      credits: 500,
      manaWei: null,
      available: 85,
      free: false
    })
    expect(listings.get('1')).toEqual({
      itemId: '1',
      currency: 'mana',
      credits: 12,
      manaWei: mana.manaWei,
      available: 10,
      free: false
    })
  })

  it('adds free listings from the items endpoint, which the catalog leaves out', async () => {
    mockServer({ data: [credits], total: 1 }, { data: [paidItem, freeItem, notOnSale] })
    const listings = await fetchCollectionListings(CONTRACT)
    expect(listings.get('0')?.free).toBe(false)
    expect(listings.get('2')).toMatchObject({ itemId: '2', free: true, available: 40 })
    expect(listings.has('3')).toBe(false)
  })

  it('skips per-token resale rows', async () => {
    mockServer({ data: [{ ...credits, tokenId: '7' }], total: 1 }, { data: [] })
    await expect(fetchCollectionListings(CONTRACT)).resolves.toEqual(new Map())
  })

  it('surfaces server failures as MarketplaceServerError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500))
    await expect(fetchCollectionListings(CONTRACT)).rejects.toBeInstanceOf(MarketplaceServerError)
  })
})

describe('toItemListing', () => {
  it('treats a MANA listing without a wei amount as MANA with no amount', () => {
    expect(toItemListing({ ...mana, manaWei: undefined })).toMatchObject({ currency: 'mana', manaWei: null })
  })

  it('ignores rows without an item id', () => {
    expect(toItemListing({ ...credits, itemId: null })).toBeNull()
  })
})

describe('isFreeListing', () => {
  it('is free at zero credits, zero MANA, or when the items endpoint sells it at 0', () => {
    expect(isFreeListing(toItemListing({ ...credits, priceCredits: 0 })!)).toBe(true)
    expect(isFreeListing(toItemListing({ ...mana, manaWei: '0' })!)).toBe(true)
    expect(isFreeListing(toFreeListing(freeItem)!)).toBe(true)
    expect(isFreeListing(toItemListing(credits)!)).toBe(false)
    expect(isFreeListing(toItemListing(mana)!)).toBe(false)
    expect(toFreeListing(notOnSale)).toBeNull()
    expect(toFreeListing(paidItem)).toBeNull()
  })
})
