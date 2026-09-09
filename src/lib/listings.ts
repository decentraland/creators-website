// Primary (mint) listings of a published collection. marketplace-server's unified shop catalog answers
// every priced on-sale item already tagged as a shop credits listing (`native`) or a MANA one made from
// the legacy marketplace (`legacy`), so no per-trade lookup is needed to know how a price is
// denominated. The catalog deliberately drops free listings (they are claims, not sales), so those are
// recovered from the plain items endpoint, which reports them as on sale at price 0.
import { config } from '~/config'
import { type Currency } from '~/components/CurrencyAmount'

export type ItemListing = {
  /** On-chain item id, the `tokenId` of the builder item. */
  itemId: string
  currency: Currency
  /** Whole credits for a credits listing; the MANA amount converted at the live rate for a MANA one. */
  credits: number
  /** MANA wei; only set for a MANA listing. */
  manaWei: string | null
  available: number
  free: boolean
}

type UnifiedListingRaw = {
  itemId: string | null
  tokenId: string | null
  priceCredits: number
  available: number
  source: 'native' | 'legacy'
  manaWei?: string | null
}

type MarketplaceItemRaw = {
  itemId: string
  /** Wei string; '0' for a free listing and for items not on sale. */
  price: string
  isOnSale: boolean
  available: number
}

// The catalog caps `first` at 1000; a collection has at most a few dozen items.
const PAGE_SIZE = 1000

export class MarketplaceServerError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'MarketplaceServerError'
    this.status = status
  }
}

export function toItemListing(raw: UnifiedListingRaw): ItemListing | null {
  if (raw.itemId === null || raw.tokenId !== null) return null
  const isMana = raw.source === 'legacy'
  const manaWei = isMana ? (raw.manaWei ?? null) : null
  return {
    itemId: raw.itemId,
    currency: isMana ? 'mana' : 'credits',
    credits: raw.priceCredits,
    manaWei,
    available: raw.available,
    free: isMana ? manaWei === '0' : raw.priceCredits === 0
  }
}

/** A free listing: the items endpoint reports it on sale at price 0; its currency is irrelevant. */
export function toFreeListing(raw: MarketplaceItemRaw): ItemListing | null {
  if (!raw.isOnSale || raw.price !== '0') return null
  return { itemId: raw.itemId, currency: 'mana', credits: 0, manaWei: '0', available: raw.available, free: true }
}

export function isFreeListing(listing: ItemListing): boolean {
  return listing.free
}

async function getJson<T>(path: string, query: Record<string, string>): Promise<T> {
  const response = await fetch(`${config.get('MARKETPLACE_SERVER_URL')}${path}?${new URLSearchParams(query)}`)
  if (!response.ok) {
    throw new MarketplaceServerError(`marketplace-server request failed: ${path} (${response.status})`, response.status)
  }
  return (await response.json()) as T
}

/** The collection's primary listings keyed by on-chain item id. Items not on sale (or sold out) are absent. */
export async function fetchCollectionListings(contractAddress: string): Promise<Map<string, ItemListing>> {
  const first = String(PAGE_SIZE)
  const [catalog, items] = await Promise.all([
    getJson<{ data?: UnifiedListingRaw[] }>('/v3/catalog/unified', { contractAddress, listingType: 'primary', first }),
    getJson<{ data?: MarketplaceItemRaw[] }>('/v1/items', { contractAddress, first })
  ])
  const listings = new Map<string, ItemListing>()
  for (const raw of catalog.data ?? []) {
    const listing = toItemListing(raw)
    if (listing) listings.set(listing.itemId, listing)
  }
  for (const raw of items.data ?? []) {
    const listing = toFreeListing(raw)
    if (listing && !listings.has(listing.itemId)) listings.set(listing.itemId, listing)
  }
  return listings
}
