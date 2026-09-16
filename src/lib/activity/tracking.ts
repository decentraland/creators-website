import { type ContractCall } from '~/lib/auth'
import { type ActivityEvent, type ActivityEventInput, type ActivityStatus } from './types'

/** The two chain calls every write flow makes, in the shape the lib flows take as deps. */
export type TransactionCalls = {
  sendTransaction: (call: ContractCall) => Promise<string>
  waitForTransaction: (txHash: string) => Promise<boolean>
}

export type ActivityTracker = {
  /** The wallet accepted the transaction; it is now pending. */
  sent: (txHash: string) => void
  /** The receipt arrived. */
  settled: (txHash: string, mined: boolean) => void
}

/** The same calls, reporting each hash to the tracker as it is sent and as it settles. */
export function withActivityTracking(calls: TransactionCalls, tracker: ActivityTracker): TransactionCalls {
  return {
    sendTransaction: async call => {
      const txHash = await calls.sendTransaction(call)
      tracker.sent(txHash)
      return txHash
    },
    waitForTransaction: async txHash => {
      const mined = await calls.waitForTransaction(txHash)
      tracker.settled(txHash, mined)
      return mined
    }
  }
}

/** The row for a transaction this tab just sent, before the server has a copy. */
export function buildLocalActivityEvent(
  input: ActivityEventInput,
  txHash: string,
  chainId: number,
  now = Date.now()
): ActivityEvent {
  return { ...input, id: `local:${txHash.toLowerCase()}`, txHash, chainId, status: 'pending', timestamp: now }
}

export function settledStatus(mined: boolean): ActivityStatus {
  return mined ? 'confirmed' : 'reverted'
}
