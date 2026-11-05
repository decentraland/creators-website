import { RARITIES, type RemoteCollectionRow, type RemoteItemRow } from '../fixtures'

export type BuilderSeed = {
  collections?: RemoteCollectionRow[]
  items?: RemoteItemRow[]
  /** Addresses seated on the curation committee. */
  committee?: string[]
}

export type BuilderResponse = { status: number; body: unknown }

type Status = 'draft' | 'published' | 'under_review' | 'rejected' | 'disabled'
const STATUSES: Status[] = ['published', 'draft', 'under_review', 'rejected', 'disabled']

const ok = (data: unknown): BuilderResponse => ({ status: 200, body: { ok: true, data } })
const notFound = (what: string): BuilderResponse => ({ status: 404, body: { ok: false, error: `${what} not found` } })

const isLinked = (row: RemoteCollectionRow) => row.urn.split(':')[3] === 'collections-thirdparty'

// Mirrors builder-server's `/:address/collections` status filter (Collection.getStatusStatement).
function statusOf(row: RemoteCollectionRow): Status | null {
  if (isLinked(row)) return null
  if (!row.is_published) return 'draft'
  if (row.curation_status === 'rejected') return 'rejected'
  if (!row.is_approved) {
    const approvedBefore =
      row.curation_status === 'approved' || (row.curation_status == null && row.reviewed_at !== row.created_at)
    return approvedBefore ? 'disabled' : 'under_review'
  }
  return row.curation_status === 'pending' ? 'under_review' : 'published'
}

function paginate<T>(rows: T[], query: URLSearchParams) {
  const page = Number(query.get('page') ?? 1)
  const limit = Number(query.get('limit') ?? rows.length)
  return {
    results: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    limit,
    pages: Math.max(1, Math.ceil(rows.length / Math.max(limit, 1)))
  }
}

/**
 * An in-memory builder-server: reads answer from the store and writes mutate it, so a reload shows what was
 * saved and a spec asserts outcomes rather than requests. Routes the suite doesn't need yet answer null.
 */
export function createBuilderServer(seed: BuilderSeed = {}) {
  const collections = new Map((seed.collections ?? []).map(row => [row.id, structuredClone(row)]))
  const items = new Map((seed.items ?? []).map(row => [row.id, structuredClone(row)]))
  const committee = seed.committee ?? []

  const itemsOf = (collectionId: string) => [...items.values()].filter(item => item.collection_id === collectionId)
  const withCount = (row: RemoteCollectionRow): RemoteCollectionRow => ({
    ...row,
    item_count: String(itemsOf(row.id).length)
  })

  function listCollections(address: string, query: URLSearchParams): BuilderResponse {
    const q = query.get('q')?.toLowerCase()
    const owned = [...collections.values()]
      .filter(row => [row.eth_address, ...row.managers, ...row.minters].some(a => a.toLowerCase() === address))
      .filter(row => !q || row.name.toLowerCase().includes(q))
    const counts = Object.fromEntries(STATUSES.map(s => [s, owned.filter(row => statusOf(row) === s).length]))
    const status = query.get('status')
    const type = query.get('type')
    const rows = owned
      .filter(row => !status || statusOf(row) === status)
      .filter(row => !type || (type === 'third_party') === isLinked(row))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(withCount)
    return ok({ ...paginate(rows, query), counts })
  }

  function handle(method: string, path: string, query: URLSearchParams, body: unknown): BuilderResponse | null {
    const parts = path.split('/').filter(Boolean)
    const [head, id, sub] = parts

    if (method === 'GET' && parts.length === 1 && head === 'committee')
      return ok(committee.map(address => ({ address })))
    if (method === 'GET' && parts.length === 1 && head === 'rarities') return ok(RARITIES)
    if (method === 'GET' && parts.length === 1 && head === 'curations') return ok([])
    if (method === 'GET' && parts.length === 1 && head === 'thirdParties') return ok([])
    if (method === 'GET' && parts.length === 2 && /^0x[0-9a-f]{40}$/i.test(head) && id === 'collections') {
      return listCollections(head.toLowerCase(), query)
    }

    if (head === 'collections' && id) {
      const row = collections.get(id)
      if (method === 'PUT' && !sub) {
        const sent = (body as { collection?: Partial<RemoteCollectionRow> } | undefined)?.collection ?? {}
        const saved = { ...(row ?? ({} as RemoteCollectionRow)), ...sent, id, updated_at: new Date().toISOString() }
        collections.set(id, saved)
        return ok(withCount(saved))
      }
      if (!row) return notFound('collection')
      if (method === 'GET' && !sub) return ok(withCount(row))
      if (method === 'DELETE' && !sub) {
        collections.delete(id)
        return ok(true)
      }
      if (method === 'GET' && sub === 'items') {
        const rows = itemsOf(id)
        return ok(query.has('page') ? paginate(rows, query) : rows)
      }
      if (method === 'GET' && sub === 'curation') return ok(null)
      if (method === 'GET' && sub === 'itemCurations') return ok([])
    }

    if (head === 'items' && id) {
      const row = items.get(id)
      if (method === 'PUT' && !sub) {
        const sent = (body as { item?: Partial<RemoteItemRow> } | undefined)?.item ?? {}
        const saved = { ...(row ?? ({} as RemoteItemRow)), ...sent, id, updated_at: new Date().toISOString() }
        items.set(id, saved)
        return ok(saved)
      }
      if (method === 'POST' && (sub === 'files' || sub === 'videos')) return { status: 200, body: { ok: true } }
      if (!row) return notFound('item')
      if (method === 'GET' && !sub) return ok(row)
      if (method === 'DELETE' && !sub) {
        items.delete(id)
        return ok(true)
      }
      if (method === 'GET' && sub === 'curation') return ok(null)
    }

    return null
  }

  return { handle, collections, items }
}

export type BuilderServer = ReturnType<typeof createBuilderServer>
