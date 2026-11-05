/** A primary listing as `GET /v1/items` reports it. */
export type MarketItem = {
  itemId: string
  contractAddress: string
  price: string
  isOnSale: boolean
  tradeId: string | null
  tradeContractAddress: string | null
}

/** A primary listing as `GET /v3/catalog/unified` reports it. */
export type CatalogRow = {
  itemId: string
  contractAddress: string
  priceCredits: number | null
  source: 'native' | 'legacy'
  tradeId: string | null
}

export type MarketSeed = { items?: MarketItem[]; catalog?: CatalogRow[]; coupons?: unknown[] }

export type MarketResponse = { status: number; body: unknown }

const ok = (data: unknown): MarketResponse => ({ status: 200, body: { ok: true, data } })

/** An in-memory marketplace-server: listings, trades and coupons, so a listing created in a spec shows up. */
export function createMarket(seed: MarketSeed = {}) {
  const items = [...(seed.items ?? [])]
  const catalog = [...(seed.catalog ?? [])]
  const trades = new Map<string, Record<string, unknown>>()
  const coupons = [...(seed.coupons ?? [])] as Array<Record<string, unknown>>

  const byContract = <T extends { contractAddress: string; itemId: string }>(rows: T[], query: URLSearchParams) =>
    rows.filter(
      row =>
        (!query.get('contractAddress') ||
          row.contractAddress.toLowerCase() === query.get('contractAddress')?.toLowerCase()) &&
        (!query.get('itemId') || row.itemId === query.get('itemId'))
    )

  function handle(method: string, path: string, query: URLSearchParams, body: unknown): MarketResponse | null {
    if (method === 'GET' && path === '/v1/items') return { status: 200, body: { data: byContract(items, query) } }
    if (method === 'GET' && path === '/v3/catalog/unified') {
      return { status: 200, body: { data: byContract(catalog, query) } }
    }
    if (method === 'GET' && path === '/v1/coupons') {
      const signer = query.get('signer')?.toLowerCase()
      return { status: 200, body: { data: coupons.filter(c => !signer || String(c.signer).toLowerCase() === signer) } }
    }
    if (method === 'POST' && path === '/v1/coupons') {
      const coupon = { id: `coupon-${coupons.length + 1}`, ...(body as object), createdAt: Date.now() }
      coupons.push(coupon)
      return ok(coupon)
    }
    if (method === 'POST' && path === '/v1/trades') {
      const id = `trade-${trades.size + 1}`
      const trade = { id, ...(body as Record<string, unknown>), createdAt: Date.now() }
      trades.set(id, trade)
      return ok(trade)
    }
    const trade = path.match(/^\/v1\/trades\/([^/]+)$/)
    if (method === 'GET' && trade) {
      const found = trades.get(trade[1])
      return found ? ok(found) : { status: 404, body: { ok: false, message: 'trade not found' } }
    }
    return null
  }

  return { handle, items, catalog, trades, coupons }
}

export type Market = ReturnType<typeof createMarket>
