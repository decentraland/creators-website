import { describe, expect, it, vi } from 'vitest'
import { type ContractCall } from '~/lib/auth'
import { buildLocalActivityEvent, settledStatus, withActivityTracking } from './tracking'

const call = { method: 'issueTokens', args: [] } as unknown as ContractCall

describe('withActivityTracking', () => {
  it('reports the hash once the wallet accepts the transaction and again once it is mined', async () => {
    const tracker = { sent: vi.fn(), settled: vi.fn() }
    const calls = withActivityTracking(
      { sendTransaction: vi.fn().mockResolvedValue('0xhash'), waitForTransaction: vi.fn().mockResolvedValue(true) },
      tracker
    )

    await expect(calls.sendTransaction(call)).resolves.toBe('0xhash')
    expect(tracker.sent).toHaveBeenCalledWith('0xhash')
    expect(tracker.settled).not.toHaveBeenCalled()

    await expect(calls.waitForTransaction('0xhash')).resolves.toBe(true)
    expect(tracker.settled).toHaveBeenCalledWith('0xhash', true)
  })

  it('reports nothing when the wallet rejects the transaction', async () => {
    const tracker = { sent: vi.fn(), settled: vi.fn() }
    const calls = withActivityTracking(
      { sendTransaction: vi.fn().mockRejectedValue(new Error('rejected')), waitForTransaction: vi.fn() },
      tracker
    )
    await expect(calls.sendTransaction(call)).rejects.toThrow('rejected')
    expect(tracker.sent).not.toHaveBeenCalled()
  })

  it('reports a revert as settled but not mined', async () => {
    const tracker = { sent: vi.fn(), settled: vi.fn() }
    const calls = withActivityTracking(
      { sendTransaction: vi.fn(), waitForTransaction: vi.fn().mockResolvedValue(false) },
      tracker
    )
    await calls.waitForTransaction('0xhash')
    expect(tracker.settled).toHaveBeenCalledWith('0xhash', false)
    expect(settledStatus(false)).toBe('reverted')
    expect(settledStatus(true)).toBe('confirmed')
  })
})

describe('buildLocalActivityEvent', () => {
  it('is a pending row for the given transaction, keyed by its hash', () => {
    expect(buildLocalActivityEvent({ type: 'approve_mana' }, '0xABC', 80002, 123)).toEqual({
      id: 'local:0xabc',
      type: 'approve_mana',
      txHash: '0xABC',
      chainId: 80002,
      status: 'pending',
      timestamp: 123
    })
  })
})
