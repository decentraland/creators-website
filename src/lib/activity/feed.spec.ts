import { describe, expect, it } from 'vitest'
import { describeActivity, getTransactionUrl, hasPendingActivity, mergeActivity } from './feed'
import { type ActivityEvent } from './types'

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: overrides.txHash ?? 'id',
    type: 'send_items',
    txHash: '0x01',
    chainId: 80002,
    status: 'confirmed',
    timestamp: 1000,
    ...overrides
  }
}

describe('mergeActivity', () => {
  it('shows a transaction sent from this tab until the server lists it, newest first', () => {
    const local = [event({ txHash: '0xAA', status: 'pending', timestamp: 3000 })]
    const server = [event({ txHash: '0x02', timestamp: 2000 }), event({ txHash: '0x01', timestamp: 1000 })]
    expect(mergeActivity(local, server).map(e => e.txHash)).toEqual(['0xAA', '0x02', '0x01'])
  })

  it('prefers the server copy once the same hash is listed, whatever its casing', () => {
    const local = [event({ txHash: '0xAA', status: 'pending', timestamp: 3000, id: 'local:0xaa' })]
    const server = [event({ txHash: '0xaa', status: 'confirmed', timestamp: 2500, id: 'server' })]
    const merged = mergeActivity(local, server)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ id: 'server', status: 'confirmed' })
  })
})

describe('hasPendingActivity', () => {
  it('is true only while some transaction is still mining', () => {
    expect(hasPendingActivity([event({ status: 'confirmed' }), event({ status: 'pending' })])).toBe(true)
    expect(hasPendingActivity([event({ status: 'confirmed' }), event({ status: 'reverted' })])).toBe(false)
    expect(hasPendingActivity([])).toBe(false)
  })
})

describe('describeActivity', () => {
  it('names the collection and item the transaction was about', () => {
    expect(describeActivity({ type: 'publish_collection', collectionName: 'Hats' })).toEqual({
      key: 'publish_collection',
      values: { collection: 'Hats', item: '', count: 0 }
    })
    expect(
      describeActivity({ type: 'remove_listing', collectionName: 'Hats', itemName: 'Beret' }).values
    ).toMatchObject({ collection: 'Hats', item: 'Beret' })
  })

  it('tells senders from collaborators for a role change', () => {
    expect(describeActivity({ type: 'set_roles', kind: 'senders' }).key).toBe('set_roles_senders')
    expect(describeActivity({ type: 'set_roles', kind: 'collaborators' }).key).toBe('set_roles_collaborators')
  })

  it('reads as a single item only when one copy of one named item was sent', () => {
    expect(describeActivity({ type: 'send_items', itemName: 'Beret', count: 1 }).key).toBe('send_item')
    expect(describeActivity({ type: 'send_items', itemName: 'Beret', count: 3 }).key).toBe('send_items')
    expect(describeActivity({ type: 'send_items', count: 1 }).key).toBe('send_items')
  })
})

describe('getTransactionUrl', () => {
  it('points at the explorer of the chain, and at nothing for an unknown chain', () => {
    expect(getTransactionUrl(137, '0xabc')).toBe('https://polygonscan.com/tx/0xabc')
    expect(getTransactionUrl(80002, '0xabc')).toBe('https://amoy.polygonscan.com/tx/0xabc')
    expect(getTransactionUrl(999, '0xabc')).toBeUndefined()
  })
})
