// Option B source: builder-server keeps a table of transactions this app reported right after sending
// them, and reads each one's status from the chain when the log is fetched.
import { fetchActivity, recordActivity } from '~/lib/builder'
import { type ActivitySource } from './source'
import {
  type ActivityEvent,
  type ActivityEventType,
  type ActivityRoleKind,
  type ActivityStatus,
  type UnsavedActivityEvent
} from './types'

export type RemoteActivityPayload = {
  collection_id?: string
  collection_name?: string
  item_id?: string
  item_name?: string
  count?: number
  kind?: ActivityRoleKind
}

export type RemoteActivityInput = {
  tx_hash: string
  chain_id: number
  type: ActivityEventType
  payload: RemoteActivityPayload
}

export type RemoteActivityEvent = RemoteActivityInput & {
  id: string
  eth_address: string
  status: ActivityStatus
  created_at: string
  updated_at: string
}

export function fromRemoteActivityEvent(remote: RemoteActivityEvent): ActivityEvent {
  const event: ActivityEvent = {
    id: remote.id,
    type: remote.type,
    txHash: remote.tx_hash,
    chainId: remote.chain_id,
    status: remote.status,
    timestamp: new Date(remote.created_at).getTime()
  }
  const { payload } = remote
  if (payload.collection_id) event.collectionId = payload.collection_id
  if (payload.collection_name) event.collectionName = payload.collection_name
  if (payload.item_id) event.itemId = payload.item_id
  if (payload.item_name) event.itemName = payload.item_name
  if (payload.count !== undefined) event.count = payload.count
  if (payload.kind) event.kind = payload.kind
  return event
}

export function toRemoteActivityInput(event: UnsavedActivityEvent): RemoteActivityInput {
  const payload: RemoteActivityPayload = {}
  if (event.collectionId) payload.collection_id = event.collectionId
  if (event.collectionName) payload.collection_name = event.collectionName
  if (event.itemId) payload.item_id = event.itemId
  if (event.itemName) payload.item_name = event.itemName
  if (event.count !== undefined) payload.count = event.count
  if (event.kind) payload.kind = event.kind
  return { tx_hash: event.txHash, chain_id: event.chainId, type: event.type, payload }
}

export const builderServerActivitySource: ActivitySource = {
  async list(address, { page, limit }) {
    const remote = await fetchActivity(address, page, limit)
    return { ...remote, results: remote.results.map(fromRemoteActivityEvent) }
  },
  async record(address, event) {
    return fromRemoteActivityEvent(await recordActivity(address, toRemoteActivityInput(event)))
  }
}
