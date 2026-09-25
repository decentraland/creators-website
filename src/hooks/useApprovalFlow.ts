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
import { fetchAllCollectionItems, fetchContent, publishCollectionItems, updateCollectionCuration } from '~/lib/builder'
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
  // A closed modal must not keep moving to the next step when a request in flight settles.
  const alive = useRef(true)

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

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['collection', address, collection.id] })
    void queryClient.invalidateQueries({ queryKey: allCollectionItemsKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: collectionCurationKey(address, collection.id) })
    void queryClient.invalidateQueries({ queryKey: ['item-entities', collection.id] })
    void queryClient.invalidateQueries({ queryKey: ['curations'] })
    void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
  }, [queryClient, address, collection.id])

  const finish = useCallback(async () => {
    if (mode === 'approve') {
      if (!collection.isApproved) {
        set({ kind: 'approve', busy: false })
        return
      }
      if (curation?.status === 'pending') {
        try {
          await updateCollectionCuration(address, collection.id, { status: 'approved' })
          track('Approve curation', { collectionId: collection.id })
        } catch (error) {
          track('Approve curation error', { collectionId: collection.id, error: errorCode(error) })
          fail('approve', error)
          return
        }
      }
    }
    refresh()
    track('Approval flow completed', { collectionId: collection.id, mode })
    set({ kind: 'success' })
  }, [mode, collection, curation, address, fail, refresh, set])

  const toDeploy = useCallback(async () => {
    const items = context.current.items
    const pointers = items.flatMap(item => (item.urn ? [item.urn] : []))
    const entities = await fetchEntitiesByPointers(pointers)
    const deploy = findItemsToDeploy(items, entities)
    context.current.deploy = deploy
    if (deploy.length > 0) set({ kind: 'deploy', count: deploy.length, busy: false, done: 0, failed: 0 })
    else await finish()
  }, [finish, set])

  const imageDeps = { fetchContent, renderCatalystImage: generateCatalystImage }

  const start = useCallback(async () => {
    alive.current = true
    set({ kind: 'loading' })
    track('Approval flow started', { collectionId: collection.id, mode })
    try {
      const items = await ensureTokenIds(await fetchItems(), {
        publishCollectionItems: () => publishCollectionItems(address, collection.id),
        fetchItems
      })
      context.current.items = items
      if (mode === 'approve') {
        const rescue = await findItemsToRescue(collection, items, item => buildMissingImage(item, imageDeps))
        context.current.rescue = rescue
        if (rescue.length > 0) {
          set({ kind: 'rescue', count: rescue.length, busy: false, sent: 0, total: 0 })
          return
        }
      }
      await toDeploy()
    } catch (error) {
      fail('prepare', error)
    }
    // imageDeps is two module functions, stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, mode, address, fetchItems, toDeploy, fail, set])

  const runRescue = useCallback(async () => {
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
      await toDeploy()
    } catch (error) {
      track('Rescue items error', { collectionId: collection.id, error: errorCode(error) })
      fail('rescue', error)
    }
  }, [collection, chainId, tx, wait, fetchItems, toDeploy, fail, set])

  const runDeploy = useCallback(async () => {
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
      await finish()
    } catch (error) {
      fail('deploy', error)
    }
    // imageDeps is two module functions, stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, address, finish, fail, set])

  const runApprove = useCallback(async () => {
    set({ kind: 'approve', busy: true })
    try {
      const txHash = await approveOnChain(collection, { chainId, sendTransaction: tx, waitForTransaction: wait })
      track('Approve collection', { collectionId: collection.id, txHash })
      // Legacy left a pending request open here, so the approved collection kept showing as under review.
      if (curation?.status === 'pending') {
        await updateCollectionCuration(address, collection.id, { status: 'approved' })
        track('Approve curation', { collectionId: collection.id })
      }
      refresh()
      track('Approval flow completed', { collectionId: collection.id, mode })
      set({ kind: 'success' })
    } catch (error) {
      track('Approve collection error', { collectionId: collection.id, error: errorCode(error) })
      fail('approve', error)
    }
  }, [collection, curation, address, chainId, tx, wait, refresh, mode, fail, set])

  const stop = useCallback(() => {
    alive.current = false
  }, [])

  return { view, start, runRescue, runDeploy, runApprove, stop }
}
