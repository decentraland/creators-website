import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import {
  deployLinkedItems,
  prepareLinkedApproval,
  setLinkedMerkleRoot,
  type LinkedApprovalPlan,
  type LinkedDeployFailure,
  type ReviewedContent
} from '~/lib/approveLinkedCollection'
import { ApprovalError, waitForIndexer, APPROVAL_INDEX_TIMEOUT_MS } from '~/lib/approveCollection'
import { sendContractTransaction, signWithIdentity, waitForTransaction, type Session } from '~/lib/auth'
import {
  fetchContent,
  fetchItem,
  fetchItemCurations,
  fetchLinkedApprovalData,
  fetchPendingLinkedItems,
  fetchThirdParty,
  updateItemCuration
} from '~/lib/builder'
import { deployEntity, fetchAvailableContent } from '~/lib/catalyst'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { generateCatalystImage } from '~/lib/media'
import { captureError } from '~/lib/monitoring'
import { getMaticChainId } from '~/lib/publishCollection'
import { buildReviewThirdPartyCall, fetchRegisteredThirdParty } from '~/lib/thirdPartyRegistry'
import { type ThirdParty } from '~/lib/thirdParty'
import { isWalletRejection } from '~/lib/walletErrors'
import { itemCurationsKey, thirdPartyKey } from './useLinkedCollection'
import { invalidateCollectionItems } from './usePublishCollection'

export function pendingLinkedItemsKey(address: string | undefined, collectionId: string | undefined) {
  return ['linked-pending-items', address, collectionId] as const
}

/** Every item of a linked collection waiting for review (committee and managers). */
export function usePendingLinkedItems(address: string | undefined, collection: Collection | undefined) {
  return useQuery({
    queryKey: pendingLinkedItemsKey(address, collection?.id),
    queryFn: () => fetchPendingLinkedItems(address!, collection!.id),
    enabled: !!address && !!collection,
    staleTime: 30_000
  })
}

export type LinkedApprovalStep = 'root' | 'deploy'

export type LinkedStepPhase =
  { kind: 'idle' } | { kind: 'signing' } | { kind: 'pending' } | { kind: 'uploading'; done: number; total: number }

export type LinkedApprovalView =
  | { kind: 'loading' }
  | { kind: 'step'; step: LinkedApprovalStep; phase: LinkedStepPhase }
  | { kind: 'success' }
  | { kind: 'error'; step: LinkedApprovalStep | 'prepare' | 'changed' | 'unsubmitted'; failed: LinkedDeployFailure[] }

const IDLE: LinkedStepPhase = { kind: 'idle' }

class RunStoppedError extends Error {
  constructor() {
    super('The approval flow was closed')
    this.name = 'RunStoppedError'
  }
}

/**
 * The committee's approval of a linked collection's pending items: put the Merkle root of every curated item on
 * chain (consuming the creator's cheque), then deploy each pending item's entity to the Catalyst and approve its
 * curation. Each step is idempotent, so a closed or failed run resumes where it stopped.
 */
export function useLinkedApprovalFlow(
  session: Session,
  collection: Collection,
  thirdParty: ThirdParty,
  review: ReviewedContent
) {
  const queryClient = useQueryClient()
  const address = session.address
  const chainId = getMaticChainId()
  const [view, setView] = useState<LinkedApprovalView>({ kind: 'loading' })
  const [plan, setPlan] = useState<LinkedApprovalPlan | null>(null)
  const [steps, setSteps] = useState<LinkedApprovalStep[]>([])
  const [running, setRunning] = useState(false)
  const run = useRef(0)

  const set = useCallback((token: number, next: LinkedApprovalView) => {
    if (token === run.current) setView(next)
  }, [])

  const refresh = useCallback(() => {
    invalidateCollectionItems(queryClient, collection.id)
    void queryClient.invalidateQueries({ queryKey: itemCurationsKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: pendingLinkedItemsKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: thirdPartyKey(address, thirdParty.id) })
    void queryClient.invalidateQueries({ queryKey: ['curations'] })
    void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
  }, [queryClient, address, collection.id, thirdParty.id])

  const fail = useCallback(
    (token: number, step: LinkedApprovalStep | 'prepare', error: unknown, failed: LinkedDeployFailure[] = []) => {
      if (token !== run.current || error instanceof RunStoppedError) return
      if (isWalletRejection(error) && step !== 'prepare') return setView({ kind: 'step', step, phase: IDLE })
      // The creator changing items mid-review is expected, not a failure to report: the curator reviews again.
      if (error instanceof ApprovalError && error.reason === 'changed') {
        track('Approve TP Collection error', { collectionId: collection.id, step: 'changed' })
        // Bring the new content to the editor, so reviewing it again is what unblocks the approval.
        refresh()
        return setView({ kind: 'error', step: 'changed', failed })
      }
      // Only the creator can fix it, by submitting the edit again.
      if (error instanceof ApprovalError && error.reason === 'unsubmitted') {
        track('Approve TP Collection error', { collectionId: collection.id, step: 'unsubmitted' })
        return setView({ kind: 'error', step: 'unsubmitted', failed })
      }
      captureError(error, { flow: 'linked_curation_approve', step, collectionId: collection.id })
      track('Approve TP Collection error', { collectionId: collection.id, step, error: errorCode(error) })
      setView({ kind: 'error', step, failed })
    },
    [collection.id, refresh]
  )

  const start = useCallback(async () => {
    const token = ++run.current
    setView({ kind: 'loading' })
    track('Approve TP Collection started', { collectionId: collection.id, thirdPartyId: thirdParty.id })
    try {
      const prepared = await prepareLinkedApproval(
        collection,
        {
          fetchPendingItems: collectionId => fetchPendingLinkedItems(address, collectionId),
          fetchApprovalData: collectionId => fetchLinkedApprovalData(address, collectionId),
          fetchItemCurations: collectionId => fetchItemCurations(address, collectionId),
          fetchRegistryRoot: async () => (await fetchRegisteredThirdParty(chainId, thirdParty.id)).root
        },
        review
      )
      if (token !== run.current) return
      const next: LinkedApprovalStep[] = [...(prepared.needsRoot ? (['root'] as const) : []), 'deploy']
      setPlan(prepared)
      setSteps(next)
      set(token, { kind: 'step', step: next[0], phase: IDLE })
    } catch (error) {
      fail(token, 'prepare', error)
    }
  }, [address, chainId, collection, thirdParty.id, review, set, fail])

  const runRoot = useCallback(async () => {
    if (!plan) return
    const token = run.current
    setRunning(true)
    try {
      set(token, { kind: 'step', step: 'root', phase: { kind: 'signing' } })
      const txHash = await setLinkedMerkleRoot(thirdParty.id, plan, {
        chainId,
        sendTransaction: async call => {
          if (token !== run.current) throw new RunStoppedError()
          const hash = await sendContractTransaction(session, call)
          set(token, { kind: 'step', step: 'root', phase: { kind: 'pending' } })
          return hash
        },
        waitForTransaction: hash => waitForTransaction(chainId, hash),
        fetchThirdParty: id => fetchThirdParty(address, id)
      })
      track('Set TP Merkle root', { collectionId: collection.id, thirdPartyId: thirdParty.id, txHash })
      void queryClient.invalidateQueries({ queryKey: thirdPartyKey(address, thirdParty.id) })
      set(token, { kind: 'step', step: 'deploy', phase: IDLE })
    } catch (error) {
      fail(token, 'root', error)
    } finally {
      setRunning(false)
    }
  }, [plan, thirdParty.id, chainId, session, address, collection.id, queryClient, set, fail])

  const runDeploy = useCallback(async () => {
    if (!plan) return
    const token = run.current
    setRunning(true)
    const total = plan.pendingItems.length
    const uploading = (done: number) =>
      set(token, { kind: 'step', step: 'deploy', phase: { kind: 'uploading', done, total } })
    uploading(0)
    try {
      const result = await deployLinkedItems(
        collection,
        plan,
        {
          fetchContent,
          renderCatalystImage: generateCatalystImage,
          sign: entityId => signWithIdentity(address, entityId),
          fetchAvailableContent,
          deployEntity,
          fetchItem: itemId => fetchItem(address, itemId),
          approveItem: itemId => updateItemCuration(address, itemId, 'approved')
        },
        uploading
      )
      refresh()
      if (result.failed.length > 0) {
        captureError(new Error(`${result.failed.length} linked items failed to deploy`), {
          flow: 'linked_curation_approve',
          step: 'deploy',
          collectionId: collection.id,
          failures: result.failed.map(failure => `${failure.item.id} (${failure.stage}): ${failure.message}`)
        })
        track('Approve TP Collection error', {
          collectionId: collection.id,
          step: 'deploy',
          items: result.failed.length
        })
        return set(token, { kind: 'error', step: 'deploy', failed: result.failed })
      }
      track('Approve TP Collection', { collectionId: collection.id, thirdPartyId: thirdParty.id, items: total })
      set(token, { kind: 'success' })
    } catch (error) {
      refresh()
      fail(token, 'deploy', error)
    } finally {
      setRunning(false)
    }
  }, [plan, collection, address, thirdParty.id, refresh, set, fail])

  const stop = useCallback(() => {
    run.current++
  }, [])

  return { view, plan, steps, running, start, runRoot, runDeploy, stop }
}

export type RejectLinkedVariables = { items: Item[] }

/**
 * Rejects the pending review of each item (the committee's verdict goes to the forum post). The collection's own
 * request is left alone: builder-server never reopens it for a later publish, so a rejected one would stick.
 */
export function useRejectLinkedItems(address: string | undefined, collection: Collection) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ items }: RejectLinkedVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      // The list on screen can be stale, and builder-server rejects any curation it is told to: only the items still
      // pending right now are rejected, so another curator's fresh approvals stay approved.
      const stillPending = new Set((await fetchPendingLinkedItems(address, collection.id)).map(item => item.id))
      const toReject = items.filter(item => stillPending.has(item.id))
      if (toReject.length === 0) throw new Error('No pending items to reject')
      for (const item of toReject) await updateItemCuration(address, item.id, 'rejected')
      return toReject.length
    },
    onSuccess: count => {
      track('Reject TP Collection', { collectionId: collection.id, items: count })
      invalidateCollectionItems(queryClient, collection.id)
      void queryClient.invalidateQueries({ queryKey: itemCurationsKey(address, collection.id) })
      void queryClient.invalidateQueries({ queryKey: pendingLinkedItemsKey(address, collection.id) })
    },
    onError: error => {
      invalidateCollectionItems(queryClient, collection.id)
      void queryClient.invalidateQueries({ queryKey: itemCurationsKey(address, collection.id) })
      track('Reject TP Collection error', { collectionId: collection.id, error: errorCode(error) })
      captureError(error, { flow: 'linked_curation_reject', collectionId: collection.id })
    }
  })
}

export type ReviewThirdPartyVariables = { thirdParty: ThirdParty; approved: boolean; onSigned?: () => void }

/** Enables or disables a whole third party on chain and waits until builder-server reads it back. */
export function useReviewThirdParty(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async ({ thirdParty, approved, onSigned }: ReviewThirdPartyVariables) => {
      if (!session) throw new Error('Wallet disconnected')
      const txHash = await sendContractTransaction(session, buildReviewThirdPartyCall(chainId, thirdParty.id, approved))
      onSigned?.()
      if (!(await waitForTransaction(chainId, txHash))) throw new Error(`Third party review ${txHash} reverted`)
      const indexed = await waitForIndexer(
        () => fetchThirdParty(session.address, thirdParty.id),
        fetched => fetched.isApproved === approved,
        APPROVAL_INDEX_TIMEOUT_MS
      ).catch(() => ({ ...thirdParty, isApproved: approved }))
      return { txHash, indexed }
    },
    onSuccess: ({ txHash, indexed }, { thirdParty, approved }) => {
      track(approved ? 'Enable third party' : 'Disable third party', { thirdPartyId: thirdParty.id, txHash })
      if (!session) return
      queryClient.setQueryData(thirdPartyKey(session.address, thirdParty.id), indexed)
      void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
    },
    onError: (error, { thirdParty, approved }) => {
      track(approved ? 'Enable third party error' : 'Disable third party error', {
        thirdPartyId: thirdParty.id,
        error: errorCode(error)
      })
      if (!isWalletRejection(error))
        captureError(error, { flow: 'linked_curation_review', thirdPartyId: thirdParty.id })
    }
  })
}

/**
 * Which pending items the curator has opened, towards the review threshold, with the content each had when opened:
 * the approval refuses to go on if the pending set or any of that content changed since.
 */
export function useReviewedItems(pendingItems: Item[], selectedId: string | null) {
  const [reviewedHashes, setReviewedHashes] = useState<Map<string, string | undefined>>(() => new Map())
  const pendingById = useMemo(() => new Map(pendingItems.map(item => [item.id, item])), [pendingItems])
  const opened = selectedId ? pendingById.get(selectedId) : undefined
  // The content on screen is what was reviewed: an item opened again after the creator changed it records the new one.
  if (opened && (!reviewedHashes.has(opened.id) || reviewedHashes.get(opened.id) !== opened.currentContentHash)) {
    setReviewedHashes(current => new Map(current).set(opened.id, opened.currentContentHash))
  }
  const nextToReview = useCallback(() => {
    const unreviewed = pendingItems.filter(item => !reviewedHashes.has(item.id))
    if (unreviewed.length === 0) return null
    return unreviewed[Math.floor(Math.random() * unreviewed.length)]
  }, [pendingItems, reviewedHashes])
  const review = useMemo<ReviewedContent>(
    () => ({
      pendingIds: new Set(pendingById.keys()),
      reviewedHashes: new Map([...reviewedHashes].filter(([id]) => pendingById.has(id)))
    }),
    [pendingById, reviewedHashes]
  )
  return { reviewedCount: review.reviewedHashes.size, nextToReview, review }
}
