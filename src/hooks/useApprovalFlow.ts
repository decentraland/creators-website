import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { allCollectionItemsKey } from '~/hooks/useCollection'
import { collectionCurationKey } from '~/hooks/useCuration'
import { errorCode, track } from '~/lib/analytics'
import {
  approveOnChain,
  deployItems,
  ensureTokenIds,
  findItemsToDeploy,
  findItemsToRescue,
  rescueItems,
  buildMissingImage,
  type DeployDeps,
  type RescueTarget
} from '~/lib/approveCollection'
import {
  sendContractTransaction,
  signWithIdentity,
  waitForTransaction,
  type ContractCall,
  type Session
} from '~/lib/auth'
import {
  fetchAllCollectionItems,
  fetchContent,
  publishCollectionItems,
  pushCollectionCuration,
  updateCollectionCuration
} from '~/lib/builder'
import { deployEntity, fetchAvailableContent, fetchEntitiesByPointers } from '~/lib/catalyst'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { type Item } from '~/lib/items'
import { generateCatalystImage } from '~/lib/media'
import { captureError } from '~/lib/monitoring'
import { getMaticChainId } from '~/lib/publishCollection'
import { isWalletRejection } from '~/lib/walletErrors'

/** `approve` runs the whole flow (also Enable); `deploy_missing` only deploys the entities an approved collection lacks. */
export type ApprovalMode = 'approve' | 'deploy_missing'

export type ApprovalView =
  | { kind: 'loading' }
  | { kind: 'rescue'; count: number; busy: boolean; sent: number; total: number }
  | { kind: 'deploy'; count: number; busy: boolean; done: number; failed: number }
  | { kind: 'approve'; busy: boolean }
  | { kind: 'success' }
  | { kind: 'error'; step: ApprovalStep }

export type ApprovalStep = 'prepare' | 'rescue' | 'deploy' | 'approve'

type Context = { items: Item[]; rescue: RescueTarget[]; deploy: Item[] }

const imageDeps = { fetchContent, renderCatalystImage: generateCatalystImage }

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
  const context = useRef<Context>({ items: [], rescue: [], deploy: [] })
  const alive = useRef(true)
  // Each start() gets a token and stop() retires it: a run settling after the modal closed (or a StrictMode
  // remount restarted it) must not move on to the next step or write anything.
  const run = useRef(0)

  const set = useCallback((next: ApprovalView) => {
    if (alive.current) setView(next)
  }, [])

  const fail = useCallback(
    (step: ApprovalStep, error: unknown) => {
      const rejected = isWalletRejection(error)
      if (!rejected) captureError(error, { flow: 'curation_approve', step, collectionId: collection.id })
      track('Approval flow error', { collectionId: collection.id, step, error: errorCode(error) })
      set({ kind: 'error', step })
    },
    [collection.id, set]
  )

  const tx = useCallback(async (call: ContractCall) => sendContractTransaction(session, call), [session])
  const wait = useCallback((txHash: string) => waitForTransaction(chainId, txHash), [chainId])
  const fetchItems = useCallback(() => fetchAllCollectionItems(address, collection.id), [address, collection.id])

  // The collection query is not refetched: builder-server reads `is_approved` from the subgraph, which lags
  // behind the approval transaction, so the on-chain result is written to the cache instead (like disable).
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: allCollectionItemsKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: collectionCurationKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: ['item-entities', collection.id] })
    void queryClient.invalidateQueries({ queryKey: ['curations'] })
    void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
  }, [queryClient, address, collection.id])

  // Legacy left a pending request open after approving, so the collection kept showing as under review.
  // A rejected first review gets a new request to approve, or it would keep reading as rejected once live.
  const complete = useCallback(async () => {
    if (mode === 'approve' && (curation?.status === 'pending' || curation?.status === 'rejected')) {
      if (curation.status === 'rejected') await pushCollectionCuration(address, collection.id)
      await updateCollectionCuration(address, collection.id, { status: 'approved' })
      track('Approve curation', { collectionId: collection.id })
    }
    refresh()
    track('Approval flow completed', { collectionId: collection.id, mode })
    set({ kind: 'success' })
  }, [mode, curation, address, collection.id, refresh, set])

  const finish = useCallback(
    async (token: number) => {
      if (token !== run.current) return
      if (mode === 'approve' && !collection.isApproved) return set({ kind: 'approve', busy: false })
      try {
        await complete()
      } catch (error) {
        track('Approve curation error', { collectionId: collection.id, error: errorCode(error) })
        fail('approve', error)
      }
    },
    [mode, collection, complete, fail, set]
  )

  const toDeploy = useCallback(
    async (token: number) => {
      const items = context.current.items
      const pointers = items.flatMap(item => (item.urn ? [item.urn] : []))
      const entities = await fetchEntitiesByPointers(pointers)
      if (token !== run.current) return
      const deploy = findItemsToDeploy(items, entities)
      context.current.deploy = deploy
      if (deploy.length > 0) set({ kind: 'deploy', count: deploy.length, busy: false, done: 0, failed: 0 })
      else await finish(token)
    },
    [finish, set]
  )

  const start = useCallback(async () => {
    const token = ++run.current
    alive.current = true
    set({ kind: 'loading' })
    track('Approval flow started', { collectionId: collection.id, mode })
    try {
      const items = await ensureTokenIds(await fetchItems(), {
        publishCollectionItems: () => publishCollectionItems(address, collection.id),
        fetchItems
      })
      if (token !== run.current) return
      context.current.items = items
      if (mode === 'approve') {
        const rescue = await findItemsToRescue(collection, items, item => buildMissingImage(item, imageDeps))
        if (token !== run.current) return
        context.current.rescue = rescue
        if (rescue.length > 0) {
          set({ kind: 'rescue', count: rescue.length, busy: false, sent: 0, total: 0 })
          return
        }
      }
      await toDeploy(token)
    } catch (error) {
      fail('prepare', error)
    }
  }, [collection, mode, address, fetchItems, toDeploy, fail, set])

  const runRescue = useCallback(async () => {
    const token = run.current
    const targets = context.current.rescue
    set({ kind: 'rescue', count: targets.length, busy: true, sent: 0, total: 0 })
    try {
      context.current.items = await rescueItems(collection, targets, {
        chainId,
        sendTransaction: tx,
        waitForTransaction: wait,
        fetchItems,
        onChunkSent: (index, total) =>
          set({ kind: 'rescue', count: targets.length, busy: true, sent: index + 1, total })
      })
      track('Rescue items', { collectionId: collection.id, item_count: targets.length })
      await toDeploy(token)
    } catch (error) {
      track('Rescue items error', { collectionId: collection.id, error: errorCode(error) })
      fail('rescue', error)
    }
  }, [collection, chainId, tx, wait, fetchItems, toDeploy, fail, set])

  const runDeploy = useCallback(async () => {
    const token = run.current
    const items = context.current.deploy
    set({ kind: 'deploy', count: items.length, busy: true, done: 0, failed: 0 })
    const deps: DeployDeps = {
      ...imageDeps,
      sign: entityId => signWithIdentity(address, entityId),
      fetchAvailableContent,
      deployEntity
    }
    try {
      const result = await deployItems(collection, items, deps, done =>
        set({ kind: 'deploy', count: items.length, busy: true, done, failed: 0 })
      )
      if (result.failed.length > 0) {
        context.current.deploy = result.failed
        track('Deploy entities failure', { collectionId: collection.id, item_count: result.failed.length })
        captureError(new Error('Some entities failed to deploy'), {
          flow: 'curation_approve',
          step: 'deploy',
          collectionId: collection.id,
          failed: result.failed.length
        })
        set({ kind: 'deploy', count: result.failed.length, busy: false, done: 0, failed: result.failed.length })
        return
      }
      track('Deploy entities', { collectionId: collection.id, item_count: items.length })
      await finish(token)
    } catch (error) {
      fail('deploy', error)
    }
  }, [collection, address, finish, fail, set])

  const runApprove = useCallback(async () => {
    set({ kind: 'approve', busy: true })
    try {
      const txHash = await approveOnChain(collection, { chainId, sendTransaction: tx, waitForTransaction: wait })
      track('Approve collection', { collectionId: collection.id, txHash })
      queryClient.setQueryData<Collection>(['collection', address, collection.id], current =>
        current ? { ...current, isApproved: true } : current
      )
      await complete()
    } catch (error) {
      track('Approve collection error', { collectionId: collection.id, error: errorCode(error) })
      fail('approve', error)
    }
  }, [collection, address, chainId, tx, wait, complete, fail, set, queryClient])

  const stop = useCallback(() => {
    alive.current = false
    run.current++
  }, [])

  return { view, start, runRescue, runDeploy, runApprove, stop }
}
