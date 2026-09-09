import { afterEach, describe, expect, it, vi } from 'vitest'
import { ethers } from 'ethers'
import { fetchCollectionListings } from './listings'

const CONTRACT = '0x00000000000000000000000000000000000000cc'
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockServer(items: unknown[], catalog: unknown[]) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(jsonResponse({ data: url.includes('/v1/items') ? items : catalog }))
  )
}

const creditsItem = { itemId: '0', price: '50000000000000000000', isOnSale: true }
const manaItem = { itemId: '1', price: '5000000000000000000', isOnSale: true }
const freeItem = { itemId: '2', price: '0', isOnSale: true }
const notOnSale = { itemId: '3', price: '7000000000000000000', isOnSale: false }
const noPrice = { itemId: '4', price: ethers.constants.MaxUint256.toString(), isOnSale: true }
const catalog = [
  { itemId: '0', priceCredits: 500, source: 'native' },
  { itemId: '1', priceCredits: 12, source: 'legacy' }
]

afterEach(() => fetchMock.mockReset())

describe('fetchCollectionListings', () => {
  it('prices credits listings from the shop catalog and everything else in MANA from the items endpoint', async () => {
    mockServer([creditsItem, manaItem, freeItem, notOnSale, noPrice], catalog)
    const listings = await fetchCollectionListings(CONTRACT)

    const urls = fetchMock.mock.calls.map(call => new URL(call[0] as string))
    expect(urls.map(url => url.origin + url.pathname).sort()).toEqual([
      'https://marketplace-api.decentraland.zone/v1/items',
      'https://marketplace-api.decentraland.zone/v3/catalog/unified'
    ])
    expect(urls.every(url => url.searchParams.get('contractAddress') === CONTRACT)).toBe(true)

    expect(listings.get('0')).toEqual({ itemId: '0', currency: 'credits', credits: 500 })
    expect(listings.get('1')).toEqual({ itemId: '1', currency: 'mana', manaWei: 5000000000000000000n })
    expect(listings.get('2')).toEqual({ itemId: '2', currency: 'mana', manaWei: 0n })
    expect(listings.has('3')).toBe(false)
    expect(listings.has('4')).toBe(false)
  })

  it('fails when either request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500))
    await expect(fetchCollectionListings(CONTRACT)).rejects.toThrow(/500/)
  })
})
