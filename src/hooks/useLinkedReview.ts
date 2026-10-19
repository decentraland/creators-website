import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import {
  deployLinkedItems,
  prepareLinkedApproval,
  setLinkedMerkleRoot,
  type LinkedApprovalPlan,
  type LinkedDeployFailure
} from '~/lib/approveLinkedCollection'
import { waitForIndexer, APPROVAL_INDEX_TIMEOUT_MS } from '~/lib/approveCollection'
import { sendContractTransaction, signWithIdentity, waitForTransaction, type Session } from '~/lib/auth'
import {
  fetchContent,
  fetchLinkedApprovalData,
  fetchPendingLinkedItems,
  fetchThirdParty,
  updateItemCuration
} from '~/lib/builder'
import { deployEntity, fetchAvailableContent } from '~/lib/catalyst'
import { CurationStatus, type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { type ItemCuration } from '~/lib/linkedItemStatus'
import { generateCatalystImage } from '~/lib/media'
import { captureError } from '~/lib/monitoring'
import { getMaticChainId } from '~/lib/publishCollection'
import { buildReviewThirdPartyCall } from '~/lib/thirdPartyRegistry'
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
  | { kind: 'error'; step: LinkedApprovalStep | 'prepare'; detail: string | null; failed: LinkedDeployFailure[] }

const IDLE: LinkedStepPhase = { kind: 'idle' }

class RunStoppedError extends Error {
  constructor() {
    super('The approval flow was closed')
    this.name = 'RunStoppedError'
  }
}

function errorDetail(error: unknown): string | null {
  if (error instanceof Error) return error.message || null
  if (typeof error === 'string') return error || null
  try {
    return JSON.stringify(error) ?? null
  } catch {
    return null
  }
}

/**
 * The committee's approval of a linked collection's pending items: put the Merkle root of every curated item on
 * chain (consuming the creator's cheque), then deploy each pending item's entity to the Catalyst and approve its
 * curation. Each step is idempotent, so a closed or failed run resumes where it stopped.
 */
export function useLinkedApprovalFlow(session: Session, collection: Collection, thirdParty: ThirdParty) {
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
      captureError(error, { flow: 'linked_curation_approve', step, collectionId: collection.id })
      track('Approve TP Collection error', { collectionId: collection.id, step, error: errorCode(error) })
      setView({ kind: 'error', step, detail: errorDetail(error), failed })
    },
    [collection.id]
  )

  const start = useCallback(async () => {
    const token = ++run.current
    setView({ kind: 'loading' })
    track('Approve TP Collection started', { collectionId: collection.id, thirdPartyId: thirdParty.id })
    try {
      const prepared = await prepareLinkedApproval(collection, {
        fetchPendingItems: collectionId => fetchPendingLinkedItems(address, collectionId),
        fetchApprovalData: collectionId => fetchLinkedApprovalData(address, collectionId)
      })
      if (token !== run.current) return
      const next: LinkedApprovalStep[] = [...(prepared.needsRoot ? (['root'] as const) : []), 'deploy']
      setPlan(prepared)
      setSteps(next)
      set(token, { kind: 'step', step: next[0], phase: IDLE })
    } catch (error) {
      fail(token, 'prepare', error)
    }
  }, [address, collection, thirdParty.id, set, fail])

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
          approveItem: itemId => updateItemCuration(address, itemId, 'approved')
        },
        uploading
      )
      refresh()
      if (result.failed.length > 0) {
        return fail(token, 'deploy', new Error('Some items failed to deploy'), result.failed)
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

export type RejectLinkedVariables = { items: Item[]; curations: Map<string, ItemCuration> }

/**
 * Rejects the pending review of each item (the committee's verdict goes to the forum post). The collection's own
 * request is left alone: builder-server never reopens it for a later publish, so a rejected one would stick.
 */
export function useRejectLinkedItems(address: string | undefined, collection: Collection) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ items, curations }: RejectLinkedVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      const pending = items.filter(item => curations.get(item.id)?.status === CurationStatus.PENDING)
      for (const item of pending) await updateItemCuration(address, item.id, 'rejected')
      return pending.length
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

/** Which pending items the curator has opened, towards the review threshold. */
export function useReviewedItems(pendingItems: Item[], selectedId: string | null) {
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set())
  const pendingIds = useMemo(() => new Set(pendingItems.map(item => item.id)), [pendingItems])
  if (selectedId && pendingIds.has(selectedId) && !reviewedIds.has(selectedId)) {
    setReviewedIds(current => new Set(current).add(selectedId))
  }
  const nextToReview = useCallback(() => {
    const unreviewed = pendingItems.filter(item => !reviewedIds.has(item.id))
    if (unreviewed.length === 0) return null
    return unreviewed[Math.floor(Math.random() * unreviewed.length)]
  }, [pendingItems, reviewedIds])
  return { reviewedCount: [...reviewedIds].filter(id => pendingIds.has(id)).length, nextToReview }
}
