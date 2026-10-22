import { describe, it, expect } from 'vitest'
import { loadPendingPayment, savePendingPayment } from './pendingLinkedPayment'

function memoryStore() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key)
  }
}

describe('pending linked payment', () => {
  it('remembers an unfinished payment per collection and forgets it once settled', () => {
    const store = memoryStore()
    savePendingPayment('c1', { txHash: '0xabc', registration: true }, store)
    expect(loadPendingPayment('c1', store)).toEqual({ txHash: '0xabc', registration: true })
    expect(loadPendingPayment('c2', store)).toBeUndefined()

    savePendingPayment('c1', undefined, store)
    expect(loadPendingPayment('c1', store)).toBeUndefined()
  })

  it('ignores anything stored that is not a payment', () => {
    const store = memoryStore()
    store.setItem('linked-publish.pending-payment.c1', '{"txHash":"nope","registration":true}')
    expect(loadPendingPayment('c1', store)).toBeUndefined()
    store.setItem('linked-publish.pending-payment.c1', 'not json')
    expect(loadPendingPayment('c1', store)).toBeUndefined()
  })

  it('survives blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      }
    }
    expect(loadPendingPayment('c1', blocked)).toBeUndefined()
    expect(() => savePendingPayment('c1', { txHash: '0x1', registration: false }, blocked)).not.toThrow()
  })
})
