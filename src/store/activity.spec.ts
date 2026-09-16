import { beforeEach, describe, expect, it } from 'vitest'
import { type ActivityEvent } from '~/lib/activity'
import { useActivityStore } from './activity'

const pending: ActivityEvent = {
  id: 'local:0xaa',
  type: 'publish_collection',
  txHash: '0xAA',
  chainId: 80002,
  status: 'pending',
  timestamp: 1
}

beforeEach(() => useActivityStore.getState().clear())

describe('activity store', () => {
  it('keeps one row per transaction, newest first', () => {
    const { add } = useActivityStore.getState()
    add(pending)
    add({ ...pending, id: 'local:0xbb', txHash: '0xBB', timestamp: 2 })
    add({ ...pending, timestamp: 3 })
    expect(useActivityStore.getState().local.map(e => e.txHash)).toEqual(['0xAA', '0xBB'])
  })

  it('takes the server copy of a row but keeps the status this tab already knows', () => {
    const { add, settle, replace } = useActivityStore.getState()
    add(pending)
    settle('0xaa', 'confirmed')
    replace('0xAA', { ...pending, id: 'server-1', status: 'pending' })
    expect(useActivityStore.getState().local[0]).toMatchObject({ id: 'server-1', status: 'confirmed' })
  })

  it('settles only the matching transaction', () => {
    const { add, settle } = useActivityStore.getState()
    add(pending)
    add({ ...pending, id: 'local:0xbb', txHash: '0xBB' })
    settle('0xbb', 'reverted')
    expect(useActivityStore.getState().local.map(e => e.status)).toEqual(['reverted', 'pending'])
  })
})
