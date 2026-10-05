import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { allCollectionItemsKey } from '~/hooks/useCollection'
import { collectionCurationKey } from '~/hooks/useCuration'
import { errorCode, track } from '~/lib/analytics'
import {
  APPROVAL_INDEX_TIMEOUT_MS,
  approveOnChain,
  buildMissingImage,
  deployItems,
  ensureTokenIds,
  findItemsToDeploy,
  findItemsToRescue,
  rescueItems,
  waitForIndexer,
  type DeployDeps,
  type DeployFailure,
  type RescueTarget
} from '~/lib/approveCollection'
import { sendContractTransaction, signWithIdentity, waitForTransaction, type Session } from '~/lib/auth'
import {
  fetchAllCollectionItems,
  fetchCollection,
  fetchContent,
  publishCollectionItems,
  pushCollectionCuration,
  updateCollectionCuration
} from '~/lib/builder'
import { deployEntity, fetchAvailableContent, fetchEntitiesByPointers } from '~/lib/catalyst'
import { RESCUE_CHUNK_SIZE } from '~/lib/collectionApproval'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { type Item } from '~/lib/items'
import { generateCatalystImage } from '~/lib/media'
import { captureError } from '~/lib/monitoring'
import { getMaticChainId } from '~/lib/publishCollection'
import { isWalletRejection } from '~/lib/walletErrors'

/** `approve` runs the whole flow (also Enable); `deploy_missing` only deploys the entities an approved collection lacks. */
export type ApprovalMode = 'approve' | 'deploy_missing'

export type ApprovalStep = 'rescue' | 'deploy' | 'approve'

/** Where a running step is: waiting for the wallet, then for the chain or the uploads. */
export type StepPhase =
  | { kind: 'idle' }
  | { kind: 'signing'; tx: number; txs: number }
  | { kind: 'pending'; tx: number; txs: number }
  | { kind: 'uploading'; done: number; total: number }

export type ApprovalView =
  | { kind: 'loading' }
  | { kind: 'step'; step: ApprovalStep; phase: StepPhase }
  | { kind: 'success' }
  | { kind: 'error'; step: ApprovalStep | 'prepare'; detail: string | null; failed: DeployFailure[] }

export type ApprovalPlan = { steps: ApprovalStep[]; rescue: RescueTarget[]; deploy: Item[] }

const IDLE: StepPhase = { kind: 'idle' }
const imageDeps = { fetchContent, renderCatalystImage: generateCatalystImage }

/** The raw failure, for curators to send to support: wallets and RPCs often throw plain objects. */
function errorDetail(error: unknown): string | null {
  if (error instanceof Error) return error.message || null
  if (typeof error === 'string') return error || null
  try {
    return JSON.stringify(error) ?? null
  } catch {
    return null
  }
}

export function useApprovalFlow(
  session: Session,
  collection: Collection,
  curation: CollectionCuration | null,
  mode: ApprovalMode
) {
  const queryClient = useQueryClient()
  const address = session.address
  const chainId = getMaticChainId()
  const [view, setView] = useState<ApprovalView>({ kind: 'loading' })
  const [plan, setPlan] = useState<ApprovalPlan>({ steps: [], rescue: [], deploy: [] })
  // Bumped by stop() and by backing out of a wallet prompt: a run that settles afterwards must not touch the
  // view or move on, but writes that follow an already-mined transaction still finish.
  const run = useRef(0)

  const set = useCallback((token: number, next: ApprovalView) => {
    if (token === run.current) setView(next)
  }, [])

  const fail = useCallback(
    (token: number, step: ApprovalStep | 'prepare', error: unknown, failed: DeployFailure[] = []) => {
      if (token !== run.current) return
      if (isWalletRejection(error) && step !== 'prepare') return setView({ kind: 'step', step, phase: IDLE })
      captureError(error, { flow: 'curation_approve', step, collectionId: collection.id })
      track('Approval flow error', { collectionId: collection.id, step, error: errorCode(error) })
      setView({ kind: 'error', step, detail: errorDetail(error), failed })
    },
    [collection.id]
  )

  const wait = useCallback((txHash: string) => waitForTransaction(chainId, txHash), [chainId])
  const fetchItems = useCallback(() => fetchAllCollectionItems(address, collection.id), [address, collection.id])

  /** Sends a transaction through the wallet, mirroring its prompt and its confirmation in the view. */
  const txSender = useCallback(
    (token: number, step: ApprovalStep, txs: number) => {
      let tx = 0
      return async (call: Parameters<typeof sendContractTransaction>[1]) => {
        tx++
        set(token, { kind: 'step', step, phase: { kind: 'signing', tx, txs } })
        const txHash = await sendContractTransaction(session, call)
        set(token, { kind: 'step', step, phase: { kind: 'pending', tx, txs } })
        return txHash
      }
    },
    [session, set]
  )

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: allCollectionItemsKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: collectionCurationKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: ['item-entities', collection.id] })
    void queryClient.invalidateQueries({ queryKey: ['curations'] })
    void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
  }, [queryClient, address, collection.id])

  // Legacy left a pending request open after approving on chain, so the collection kept asking to be approved.
  // The request is read from the cache: assigning it mid-flow may have replaced the one the modal opened with.
  const complete = useCallback(
    async (token: number) => {
      const latest =
        queryClient.getQueryData<CollectionCuration | null>(collectionCurationKey(address, collection.id)) ?? curation
      if (mode === 'approve' && (latest?.status === 'pending' || latest?.status === 'rejected')) {
        // A rejected first review gets a new request to approve, or it would keep reading as rejected once live.
        if (latest.status === 'rejected') await pushCollectionCuration(address, collection.id)
        await updateCollectionCuration(address, collection.id, { status: 'approved' })
        track('Approve curation', { collectionId: collection.id })
      }
      refresh()
      track('Approval flow completed', { collectionId: collection.id, mode })
      set(token, { kind: 'success' })
    },
    [queryClient, address, collection.id, curation, mode, refresh, set]
  )

  const goTo = useCallback(
    async (token: number, steps: ApprovalStep[], after: ApprovalStep | null) => {
      const next = steps[after ? steps.indexOf(after) + 1 : 0]
      if (next) return set(token, { kind: 'step', step: next, phase: IDLE })
      try {
        await complete(token)
      } catch (error) {
        fail(token, 'approve', error)
      }
    },
    [complete, fail, set]
  )

  const start = useCallback(async () => {
    const token = ++run.current
    setView({ kind: 'loading' })
    track('Approval flow started', { collectionId: collection.id, mode })
    try {
      const items = await ensureTokenIds(await fetchItems(), {
        publishCollectionItems: () => publishCollectionItems(address, collection.id),
        fetchItems
      })
      // Rescuing rewrites only on-chain hashes, so what to deploy is known before it runs.
      const [rescue, entities] = await Promise.all([
        mode === 'approve'
          ? findItemsToRescue(collection, items, item => buildMissingImage(item, imageDeps))
          : Promise.resolve([]),
        fetchEntitiesByPointers(items.flatMap(item => (item.urn ? [item.urn] : [])))
      ])
      if (token !== run.current) return
      const deploy = findItemsToDeploy(items, entities)
      const steps: ApprovalStep[] = [
        ...(rescue.length > 0 ? ['rescue' as const] : []),
        ...(deploy.length > 0 ? ['deploy' as const] : []),
        ...(mode === 'approve' && !collection.isApproved ? ['approve' as const] : [])
      ]
      setPlan({ steps, rescue, deploy })
      await goTo(token, steps, null)
    } catch (error) {
      fail(token, 'prepare', error)
    }
  }, [collection, mode, address, fetchItems, goTo, fail])

  const runRescue = useCallback(async () => {
    const token = run.current
    const txs = Math.ceil(plan.rescue.length / RESCUE_CHUNK_SIZE)
    try {
      await rescueItems(collection, plan.rescue, {
        chainId,
        sendTransaction: txSender(token, 'rescue', txs),
        waitForTransaction: wait,
        fetchItems
      })
      track('Rescue items', { collectionId: collection.id, item_count: plan.rescue.length })
      await goTo(token, plan.steps, 'rescue')
    } catch (error) {
      track('Rescue items error', { collectionId: collection.id, error: errorCode(error) })
      fail(token, 'rescue', error)
    }
  }, [collection, plan, chainId, txSender, wait, fetchItems, goTo, fail])

  const runDeploy = useCallback(async () => {
    const token = run.current
    const items = plan.deploy
    const uploading = (done: number) =>
      set(token, { kind: 'step', step: 'deploy', phase: { kind: 'uploading', done, total: items.length } })
    uploading(0)
    const deps: DeployDeps = {
      ...imageDeps,
      sign: entityId => signWithIdentity(address, entityId),
      fetchAvailableContent,
      deployEntity
    }
    try {
      const result = await deployItems(collection, items, deps, uploading)
      if (result.failed.length > 0) {
        track('Deploy entities failure', { collectionId: collection.id, item_count: result.failed.length })
        return fail(token, 'deploy', new Error('Some entities failed to deploy'), result.failed)
      }
      track('Deploy entities', { collectionId: collection.id, item_count: items.length })
      await goTo(token, plan.steps, 'deploy')
    } catch (error) {
      fail(token, 'deploy', error)
    }
  }, [collection, plan, address, goTo, fail, set])

  const runApprove = useCallback(async () => {
    const token = run.current
    try {
      const txHash = await approveOnChain(collection, {
        chainId,
        sendTransaction: txSender(token, 'approve', 1),
        waitForTransaction: wait
      })
      track('Approve collection', { collectionId: collection.id, txHash })
      // Success waits for builder-server, which reads `is_approved` from a lagging subgraph, so a reload right
      // after it shows the collection approved. Past the timeout the cache carries the on-chain result instead.
      const indexed = await waitForIndexer(
        () => fetchCollection(address, collection.id),
        fetched => fetched.isApproved,
        APPROVAL_INDEX_TIMEOUT_MS
      ).catch(() => ({ ...collection, isApproved: true }))
      queryClient.setQueryData<Collection>(['collection', address, collection.id], indexed)
      await complete(token)
    } catch (error) {
      track('Approve collection error', { collectionId: collection.id, error: errorCode(error) })
      fail(token, 'approve', error)
    }
  }, [collection, address, chainId, txSender, wait, complete, fail, queryClient])

  /** Backs out of the wallet prompt: the step reopens, and whatever the wallet answers later is ignored. */
  const cancelSigning = useCallback(() => {
    if (view.kind !== 'step') return
    run.current++
    setView({ kind: 'step', step: view.step, phase: IDLE })
  }, [view])

  const stop = useCallback(() => {
    run.current++
  }, [])

  return { view, plan, start, runRescue, runDeploy, runApprove, cancelSigning, stop }
}
