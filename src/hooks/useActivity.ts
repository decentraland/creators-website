import { useCallback } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildLocalActivityEvent,
  getActivitySource,
  hasPendingActivity,
  settledStatus,
  withActivityTracking,
  type ActivityEventInput,
  type ActivityTracker,
  type TransactionCalls
} from '~/lib/activity'
import { sendContractTransaction, waitForTransaction, type Session } from '~/lib/auth'
import { getMaticChainId } from '~/lib/publishCollection'
import { useActivityStore } from '~/store/activity'

export const ACTIVITY_PAGE_SIZE = 20
// While a transaction on the page is mining, the server re-reads its receipt on every fetch.
const PENDING_REFETCH_MS = 10_000

export function useActivity(address: string | undefined, page: number) {
  return useQuery({
    queryKey: ['activity', address, page],
    queryFn: () => getActivitySource().list(address!, { page, limit: ACTIVITY_PAGE_SIZE }),
    enabled: !!address,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: query => (hasPendingActivity(query.state.data?.results ?? []) ? PENDING_REFETCH_MS : false)
  })
}

/**
 * Reports a flow's transactions to the log: locally the moment the wallet accepts them (so the page and
 * the nav badge show them at once) and to the server in the background. A failed report is logged, not
 * surfaced: the transaction itself went through.
 */
export function useActivityTracker(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useCallback(
    (input: ActivityEventInput): ActivityTracker => ({
      sent: txHash => {
        if (!session) return
        const { add, replace } = useActivityStore.getState()
        const event = buildLocalActivityEvent(input, txHash, chainId)
        add(event)
        getActivitySource()
          .record(session.address, event)
          .then(saved => replace(txHash, saved))
          .catch((error: unknown) => console.error('Activity record failed', error))
      },
      settled: (txHash, mined) => {
        useActivityStore.getState().settle(txHash, settledStatus(mined))
        void queryClient.invalidateQueries({ queryKey: ['activity', session?.address] })
      }
    }),
    [session, chainId, queryClient]
  )
}

/** The wallet's send/wait pair for the Polygon chain, reporting to the log under the given description. */
export function useTrackedTransactionCalls(session: Session | null) {
  const track = useActivityTracker(session)
  const chainId = getMaticChainId()
  return useCallback(
    (input: ActivityEventInput): TransactionCalls => {
      if (!session) throw new Error('Wallet disconnected')
      return withActivityTracking(
        {
          sendTransaction: call => sendContractTransaction(session, call),
          waitForTransaction: txHash => waitForTransaction(chainId, txHash)
        },
        track(input)
      )
    },
    [session, chainId, track]
  )
}
