import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchActivity, recordActivity } from '~/lib/builder'
import {
  builderServerActivitySource,
  fromRemoteActivityEvent,
  toRemoteActivityInput,
  type RemoteActivityEvent
} from './builderServer'
import { DEFAULT_ACTIVITY_SOURCE, getActivitySource } from './source'

vi.mock('~/lib/builder', () => ({ fetchActivity: vi.fn(), recordActivity: vi.fn() }))

const remote: RemoteActivityEvent = {
  id: 'evt-1',
  eth_address: '0xabc',
  tx_hash: '0xhash',
  chain_id: 80002,
  type: 'send_items',
  payload: { collection_id: 'col-1', collection_name: 'Hats', item_id: 'item-1', item_name: 'Beret', count: 2 },
  status: 'pending',
  created_at: '2026-09-15T10:00:00.000Z',
  updated_at: '2026-09-15T10:00:00.000Z'
}

beforeEach(() => {
  vi.mocked(fetchActivity).mockReset()
  vi.mocked(recordActivity).mockReset()
})

describe('builder-server activity source', () => {
  it('is the source the app uses by default, and the fallback for an unknown name', () => {
    expect(getActivitySource(DEFAULT_ACTIVITY_SOURCE)).toBe(builderServerActivitySource)
    expect(getActivitySource('something-else')).toBe(builderServerActivitySource)
  })

  it('lists the page as app events, keeping the pagination stats', async () => {
    vi.mocked(fetchActivity).mockResolvedValue({ results: [remote], total: 21, page: 2, limit: 20, pages: 2 })
    const page = await builderServerActivitySource.list('0xABC', { page: 2, limit: 20 })
    expect(fetchActivity).toHaveBeenCalledWith('0xABC', 2, 20)
    expect(page).toEqual({
      total: 21,
      page: 2,
      limit: 20,
      pages: 2,
      results: [
        {
          id: 'evt-1',
          type: 'send_items',
          txHash: '0xhash',
          chainId: 80002,
          status: 'pending',
          timestamp: Date.parse('2026-09-15T10:00:00.000Z'),
          collectionId: 'col-1',
          collectionName: 'Hats',
          itemId: 'item-1',
          itemName: 'Beret',
          count: 2
        }
      ]
    })
  })

  it('records a sent transaction in the server shape and returns the stored copy', async () => {
    vi.mocked(recordActivity).mockResolvedValue({
      ...remote,
      type: 'set_roles',
      payload: { collection_id: 'col-1', kind: 'senders' }
    })
    const saved = await builderServerActivitySource.record('0xabc', {
      type: 'set_roles',
      kind: 'senders',
      collectionId: 'col-1',
      txHash: '0xhash',
      chainId: 80002
    })
    expect(recordActivity).toHaveBeenCalledWith('0xabc', {
      tx_hash: '0xhash',
      chain_id: 80002,
      type: 'set_roles',
      payload: { collection_id: 'col-1', kind: 'senders' }
    })
    expect(saved).toMatchObject({ id: 'evt-1', type: 'set_roles', kind: 'senders', collectionId: 'col-1' })
  })

  it('round-trips an event without a subject', () => {
    const input = toRemoteActivityInput({ type: 'approve_mana', txHash: '0x1', chainId: 137 })
    expect(input).toEqual({ tx_hash: '0x1', chain_id: 137, type: 'approve_mana', payload: {} })
    expect(fromRemoteActivityEvent({ ...remote, type: 'approve_mana', payload: {} })).not.toHaveProperty('collectionId')
  })
})
