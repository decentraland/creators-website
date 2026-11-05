import { ethers } from 'ethers'
import { RARITIES, collection, wearable, type RemoteCollectionRow, type RemoteItemRow } from '../fixtures'
import { decodeTransaction, type SentTransaction } from './rpc'

export type BuilderSeed = {
  collections?: RemoteCollectionRow[]
  items?: RemoteItemRow[]
  curations?: RemoteCurationRow[]
  /** Addresses seated on the curation committee. */
  committee?: string[]
}

export type BuilderResponse = { status: number; body: unknown }

type Status = 'draft' | 'published' | 'under_review' | 'rejected' | 'disabled'
const STATUSES: Status[] = ['published', 'draft', 'under_review', 'rejected', 'disabled']

// What builder-server keeps from its own row on a PUT, whatever the client sends.
const SERVER_OWNED_COLLECTION_FIELDS = [
  'eth_address',
  'urn',
  'lock',
  'created_at',
  'updated_at',
  'forum_link',
  'reviewed_at',
  'is_published',
  'is_approved'
] as const
const SERVER_OWNED_ITEM_FIELDS = [
  'eth_address',
  'blockchain_item_id',
  'is_published',
  'is_approved',
  'in_catalyst',
  'total_supply',
  'created_at',
  'updated_at'
] as const

function withoutFields<T extends object>(sent: Partial<T>, fields: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(sent).filter(([key]) => !fields.includes(key))) as Partial<T>
}

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

export type RemoteCurationRow = {
  id: string
  collection_id: string
  status: 'pending' | 'approved' | 'rejected'
  assignee: string | null
  created_at: string
  updated_at: string
}

const conflict = (error: string, data?: unknown): BuilderResponse => ({ status: 409, body: { ok: false, error, data } })
const now = () => new Date().toISOString()
const hashOf = (text: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(text))

/**
 * An in-memory builder-server: reads answer from the store and writes mutate it, so a reload shows what was
 * saved and a spec asserts outcomes rather than requests. Routes the suite doesn't need yet answer null.
 */
export function createBuilderServer(seed: BuilderSeed = {}) {
  const collections = new Map((seed.collections ?? []).map(row => [row.id, structuredClone(row)]))
  const items = new Map((seed.items ?? []).map(row => [row.id, structuredClone(row)]))
  const curations = new Map((seed.curations ?? []).map(row => [row.collection_id, structuredClone(row)]))
  const committee = seed.committee ?? []

  const itemsOf = (collectionId: string) => [...items.values()].filter(item => item.collection_id === collectionId)
  const withCount = (row: RemoteCollectionRow): RemoteCollectionRow => ({
    ...row,
    item_count: String(itemsOf(row.id).length)
  })
  const byContract = (address: string) =>
    [...collections.values()].find(row => row.contract_address?.toLowerCase() === address.toLowerCase())

  function setCuration(collectionId: string, curation: RemoteCurationRow) {
    curations.set(collectionId, curation)
    const row = collections.get(collectionId)
    if (row) row.curation_status = curation.status
  }

  function listCollections(address: string, query: URLSearchParams): BuilderResponse {
    const q = query.get('q')?.toLowerCase()
    const published = query.get('is_published')
    const owned = [...collections.values()]
      .filter(row => [row.eth_address, ...row.managers, ...row.minters].some(a => a.toLowerCase() === address))
      .filter(row => !q || row.name.toLowerCase().includes(q))
      .filter(row => published === null || String(row.is_published) === published)
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

  // builder-server's curation filters (Collection.model getCurationStatusStatement), standard collections only.
  function curationStatusMatches(row: RemoteCollectionRow, status: string): boolean {
    const curation = curations.get(row.id)
    const onChain = !!row.contract_address && row.is_published
    const reviewed = row.reviewed_at !== null && row.reviewed_at !== row.created_at
    switch (status) {
      case 'pending':
        return curation ? curation.status === 'pending' && !row.is_approved : !row.is_approved
      case 'approved':
        return curation ? curation.status === 'approved' && row.is_approved : row.is_approved
      case 'rejected':
        return curation?.status === 'rejected' && onChain
      case 'to_review':
        return (
          !curation?.assignee &&
          onChain &&
          (curation?.status === 'pending' || (!curation && !row.is_approved && !reviewed))
        )
      case 'under_review':
        return !!curation?.assignee && curation.status === 'pending'
      case 'disabled':
        return !row.is_approved && (curation?.status === 'approved' || (!curation && reviewed))
      default:
        return false
    }
  }

  function listCurationCollections(query: URLSearchParams): BuilderResponse {
    const statuses = query.getAll('status')
    const assignees = query.getAll('assignee').map(a => a.toLowerCase())
    const reviewType = query.get('review_type')
    const q = query.get('q')?.toLowerCase()
    const rows = [...collections.values()]
      .filter(row => row.is_published && !isLinked(row))
      .filter(row => !q || row.name.toLowerCase().includes(q))
      .filter(row => statuses.length === 0 || statuses.some(status => curationStatusMatches(row, status)))
      .filter(row => {
        if (assignees.length === 0) return true
        const assignee = curations.get(row.id)?.assignee?.toLowerCase() ?? null
        return assignees.some(a => (a === 'unassigned' ? assignee === null : a === assignee))
      })
      .filter(row => {
        if (!reviewType) return true
        const approvedBefore = row.is_approved || (row.reviewed_at !== null && row.reviewed_at !== row.created_at)
        return reviewType === 'updates' ? approvedBefore : !approvedBefore
      })
      .map(withCount)
    return ok(paginate(rows, query))
  }

  function saveCollection(id: string, body: unknown): BuilderResponse {
    const { collection: sent = {}, data } = (body ?? {}) as { collection?: Partial<RemoteCollectionRow>; data?: string }
    const row = collections.get(id)
    const name = sent.name ?? row?.name
    const taken = [...collections.values()].some(
      other => other.id !== id && other.name.toLowerCase() === name?.toLowerCase()
    )
    if (taken) return conflict('Name already in use')
    const saved: RemoteCollectionRow = {
      ...(row ?? collection({ created_at: now() })),
      ...withoutFields(sent, SERVER_OWNED_COLLECTION_FIELDS),
      id,
      updated_at: now()
    }
    // The real server derives both from the factory and the initialize calldata.
    if (data && !saved.is_published) {
      saved.salt = hashOf(id)
      saved.contract_address = '0x' + hashOf(`${saved.salt}${data}`).slice(-40)
    }
    collections.set(id, saved)
    return ok(withCount(saved))
  }

  // What the indexer behind builder-server would learn from a mined transaction.
  function applyTransaction(tx: SentTransaction) {
    const row = byContract(tx.to)
    const args = tx.args
    if (row && tx.fn === 'transferCreatorship' && args) row.eth_address = String(args.creator).toLowerCase()
    if (row && (tx.fn === 'setMinters' || tx.fn === 'setManagers') && args) {
      const key = tx.fn === 'setMinters' ? 'minters' : 'managers'
      const [addresses, values] = [args[0] as string[], args[1] as boolean[]]
      const next = new Set(row[key].map(a => a.toLowerCase()))
      addresses.forEach((address, index) =>
        values[index] ? next.add(address.toLowerCase()) : next.delete(address.toLowerCase())
      )
      row[key] = [...next]
    }
    if (tx.fn === 'manageCollection' && args) {
      const target = byContract(String(args.collection))
      for (const call of args.data as string[]) {
        const inner = decodeTransaction({ hash: tx.hash, from: tx.from, to: String(args.collection), data: call })
        if (target && inner.fn === 'setApproved' && inner.args) {
          target.is_approved = Boolean(inner.args.value)
          target.reviewed_at = now()
        }
        if (target && inner.fn === 'rescueItems' && inner.args) {
          const ids = (inner.args.itemIds as ethers.BigNumber[]).map(String)
          const hashes = inner.args.contentHashes as string[]
          for (const item of itemsOf(target.id)) {
            const index = ids.indexOf(String(item.blockchain_item_id))
            if (index !== -1) item.content_hash = hashes[index]
          }
        }
      }
    }
  }

  function handleCollection(
    method: string,
    id: string,
    sub: string | undefined,
    query: URLSearchParams,
    body: unknown
  ) {
    if (method === 'PUT' && !sub) return saveCollection(id, body)
    const row = collections.get(id)
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
    if (method === 'POST' && sub === 'tos') return { status: 200, body: { ok: true } }
    if (method === 'POST' && sub === 'lock') {
      row.lock = now()
      return ok(row.lock)
    }
    if (method === 'POST' && sub === 'publish') {
      row.is_published = true
      row.urn = `urn:decentraland:amoy:collections-v2:${row.contract_address}`
      itemsOf(id).forEach((item, index) => {
        item.is_published = true
        item.blockchain_item_id ??= String(index)
        item.urn = `${row.urn}:${item.blockchain_item_id}`
      })
      return ok({ collection: withCount(row), items: itemsOf(id) })
    }
    if (method === 'POST' && sub === 'post') {
      if (row.forum_link) return conflict('The forum post already exists', { forum_link: row.forum_link })
      row.forum_link = `https://forum.decentraland.org/t/e2e-${id}`
      return ok(row.forum_link)
    }
    if (method === 'GET' && sub === 'curation') return ok(curations.get(id) ?? null)
    if (method === 'POST' && sub === 'curation') {
      if (curations.get(id)?.status === 'pending')
        return { status: 400, body: { ok: false, error: 'There is already an ongoing review request' } }
      const { assignee = null } = (body as { curation?: { assignee?: string | null } })?.curation ?? {}
      const curation: RemoteCurationRow = {
        id: `curation-${id}`,
        collection_id: id,
        status: 'pending',
        assignee,
        created_at: now(),
        updated_at: now()
      }
      setCuration(id, curation)
      return ok(curation)
    }
    if (method === 'PATCH' && sub === 'curation') {
      const current = curations.get(id)
      if (!current) return notFound('curation')
      const changes = (body as { curation?: Partial<RemoteCurationRow> })?.curation ?? {}
      const curation = { ...current, ...changes, updated_at: now() }
      setCuration(id, curation)
      return ok(curation)
    }
    if (method === 'GET' && sub === 'itemCurations') return ok([])
    return null
  }

  function handleItem(method: string, id: string, sub: string | undefined, body: unknown) {
    const row = items.get(id)
    if (method === 'PUT' && !sub) {
      const sent = (body as { item?: Partial<RemoteItemRow> } | undefined)?.item ?? {}
      const saved: RemoteItemRow = {
        ...(row ?? wearable({ created_at: now() })),
        ...withoutFields(sent, SERVER_OWNED_ITEM_FIELDS),
        id,
        updated_at: now()
      }
      items.set(id, saved)
      return ok(saved)
    }
    if (!row) return notFound('item')
    if (method === 'GET' && !sub) return ok(row)
    if (method === 'DELETE' && !sub) {
      items.delete(id)
      return ok(true)
    }
    if (method === 'GET' && sub === 'curation') return ok(null)
    return null
  }

  function handle(method: string, path: string, query: URLSearchParams, body: unknown): BuilderResponse | null {
    const parts = path.split('/').filter(Boolean)
    const [head, id, sub, subPath] = parts

    if (method === 'GET' && parts.length === 1 && head === 'committee')
      return ok(committee.map(address => ({ address })))
    if (method === 'GET' && parts.length === 1 && head === 'rarities') return ok(RARITIES)
    if (method === 'GET' && parts.length === 1 && head === 'curations') return ok([...curations.values()])
    if (method === 'GET' && parts.length === 1 && head === 'thirdParties') return ok([])
    if (method === 'GET' && parts.length === 2 && /^0x[0-9a-f]{40}$/i.test(head) && id === 'collections') {
      return listCollections(head.toLowerCase(), query)
    }
    if (head === 'collections' && id && sub === 'owner' && subPath === 'sync' && method === 'POST') {
      const row = collections.get(id)
      return row ? ok(withCount(row)) : notFound('collection')
    }
    if (method === 'GET' && parts.length === 1 && head === 'collections') return listCurationCollections(query)
    if (head === 'collections' && id && sub === 'curation' && subPath === 'post' && method === 'POST') {
      return collections.has(id) ? { status: 200, body: { ok: true } } : notFound('collection')
    }
    if (head === 'collections' && id) return handleCollection(method, id, sub, query, body)
    if (head === 'items' && id) return handleItem(method, id, sub, body)
    return null
  }

  return { handle, applyTransaction, collections, items, curations }
}

export type BuilderServer = ReturnType<typeof createBuilderServer>
