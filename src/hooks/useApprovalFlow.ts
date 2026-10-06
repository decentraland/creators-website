import { useCallback, useMemo, useRef, useState } from 'react'
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

/** `changed`: the creator edited items after the curator opened them, so approving would ship unseen content. */
export type ApprovalFailure = ApprovalStep | 'prepare' | 'changed'

export type ApprovalView =
  | { kind: 'loading' }
  | { kind: 'step'; step: ApprovalStep; phase: StepPhase }
  | { kind: 'success' }
  | { kind: 'error'; step: ApprovalFailure; detail: string | null; failed: DeployFailure[] }

export type ApprovalPlan = { steps: ApprovalStep[]; rescue: RescueTarget[]; deploy: Item[] }

const IDLE: StepPhase = { kind: 'idle' }

class ItemsChangedError extends Error {
  constructor() {
    super('Items changed since the review was opened')
    this.name = 'ItemsChangedError'
  }
}

class RunStoppedError extends Error {
  constructor() {
    super('The approval flow was closed')
    this.name = 'RunStoppedError'
  }
}

const rescueKey = ({ item, contentHash }: RescueTarget) => `${item.id}:${contentHash}`

/** Whether the items still match what the curator reviewed: same set, none saved since. */
function matchesReview(items: Item[], reviewed: Item[]): boolean {
  const seen = new Map(reviewed.map(item => [item.id, item.updatedAt]))
  return items.length === seen.size && items.every(item => seen.get(item.id) === item.updatedAt)
}

const contentOf = (item: Item) =>
  JSON.stringify([
    Object.entries(item.contents).sort(([a], [b]) => a.localeCompare(b)),
    item.data,
    item.name,
    item.description,
    item.currentContentHash
  ])

/** The same check on what ships, for a list the token-id backfill saved again (so `updatedAt` moved anyway). */
function matchesReviewedContent(items: Item[], reviewed: Item[]): boolean {
  const seen = new Map(reviewed.map(item => [item.id, contentOf(item)]))
  return items.length === seen.size && items.every(item => seen.get(item.id) === contentOf(item))
}
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
  mode: ApprovalMode,
  reviewed: Item[]
) {
  const queryClient = useQueryClient()
  const address = session.address
  const chainId = getMaticChainId()
  const [view, setView] = useState<ApprovalView>({ kind: 'loading' })
  const [plan, setPlan] = useState<ApprovalPlan>({ steps: [], rescue: [], deploy: [] })
  // Bumped by start() and stop(): a run that settles afterwards must not touch the view or move on, but writes that
  // follow an already-mined transaction still finish.
  const run = useRef(0)
  // The step whose transaction or upload is in flight, and where it is: backing out of the wallet prompt only hides
  // it, and clicking the step again shows it instead of starting a second, duplicate run.
  const inFlight = useRef<{ step: ApprovalStep; phase: StepPhase } | null>(null)
  // Rescue chunks already mined in this session, so a retry after a rejected later chunk doesn't pay for them again.
  const mined = useRef<RescueTarget[]>([])
  const dismissed = useRef(false)
  // Mirrors `inFlight` for rendering: the modal can't close while a request is open in the wallet or a step runs.
  const [running, setRunning] = useState(false)

  const set = useCallback((token: number, next: ApprovalView) => {
    if (token === run.current) setView(next)
  }, [])

  const fail = useCallback(
    (token: number, step: ApprovalFailure, error: unknown, failed: DeployFailure[] = []) => {
      if (token !== run.current || error instanceof RunStoppedError) return
      if (error instanceof ItemsChangedError) return setView({ kind: 'error', step: 'changed', detail: null, failed })
      if (isWalletRejection(error) && step !== 'prepare' && step !== 'changed') {
        return setView({ kind: 'step', step, phase: IDLE })
      }
      captureError(error, { flow: 'curation_approve', step, collectionId: collection.id })
      track('Approval flow error', { collectionId: collection.id, step, error: errorCode(error) })
      setView({ kind: 'error', step, detail: errorDetail(error), failed })
    },
    [collection.id]
  )

  const wait = useCallback((txHash: string) => waitForTransaction(chainId, txHash), [chainId])
  const fetchItems = useCallback(() => fetchAllCollectionItems(address, collection.id), [address, collection.id])

  /** Moves the in-flight step to `phase` and shows it; a wallet prompt the curator backed out of stays hidden. */
  const progress = useCallback(
    (token: number, step: ApprovalStep, phase: StepPhase) => {
      inFlight.current = { step, phase }
      if (phase.kind === 'signing' && dismissed.current) return
      dismissed.current = false
      set(token, { kind: 'step', step, phase })
    },
    [set]
  )

  /**
   * Sends a transaction through the wallet, mirroring its prompt and its confirmation in the view. A closed flow
   * opens no further prompts: the next chunk of a multi-transaction step is never sent.
   */
  const txSender = useCallback(
    (token: number, step: ApprovalStep, txs: number) => {
      let tx = 0
      return async (call: Parameters<typeof sendContractTransaction>[1]) => {
        if (token !== run.current) throw new RunStoppedError()
        tx++
        progress(token, step, { kind: 'signing', tx, txs })
        const txHash = await sendContractTransaction(session, call)
        progress(token, step, { kind: 'pending', tx, txs })
        return txHash
      }
    },
    [session, progress]
  )

  /** Runs a step once: while it is in flight, asking again shows where it is instead of sending it twice. */
  const once = useCallback(
    (step: ApprovalStep, body: (token: number) => Promise<void>) => async () => {
      dismissed.current = false
      if (inFlight.current) return setView({ kind: 'step', ...inFlight.current })
      inFlight.current = { step, phase: IDLE }
      setRunning(true)
      try {
        await body(run.current)
      } finally {
        inFlight.current = null
        setRunning(false)
      }
    },
    []
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
      const key = collectionCurationKey(address, collection.id)
      const latest = queryClient.getQueryData<CollectionCuration | null>(key) ?? curation
      // An approved request (Enable on a disabled collection) has nothing left to close.
      if (mode === 'approve' && latest?.status !== 'approved') {
        try {
          // A rejected first review, or a collection enabled without any request, gets a request in the approver's
          // name to approve; otherwise it would keep reading as rejected, or name nobody as its curator.
          if (latest?.status !== 'pending') {
            const opened = await pushCollectionCuration(address, collection.id, address.toLowerCase())
            // A failed approval below must find this one on retry, not open another (builder-server answers 400).
            queryClient.setQueryData(key, opened)
          }
          queryClient.setQueryData(key, await updateCollectionCuration(address, collection.id, { status: 'approved' }))
        } catch (error) {
          void queryClient.invalidateQueries({ queryKey: key })
          throw error
        }
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
      const fetched = await fetchItems()
      // Before the token-id backfill, which saves the items again.
      if (!matchesReview(fetched, reviewed)) throw new ItemsChangedError()
      const items = await ensureTokenIds(fetched, {
        publishCollectionItems: () => publishCollectionItems(address, collection.id),
        fetchItems
      })
      if (items !== fetched && !matchesReviewedContent(items, reviewed)) throw new ItemsChangedError()
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
  }, [collection, mode, address, reviewed, fetchItems, goTo, fail])

  const runRescue = useMemo(
    () =>
      once('rescue', async token => {
        const done = new Set(mined.current.map(rescueKey))
        const pending = plan.rescue.filter(target => !done.has(rescueKey(target)))
        const txs = Math.ceil(pending.length / RESCUE_CHUNK_SIZE)
        try {
          await rescueItems(collection, pending, {
            chainId,
            sendTransaction: txSender(token, 'rescue', txs),
            waitForTransaction: wait,
            fetchItems,
            onChunkMined: targets => mined.current.push(...targets),
            alreadyMined: mined.current.filter(target =>
              plan.rescue.some(planned => rescueKey(planned) === rescueKey(target))
            )
          })
          track('Rescue items', { collectionId: collection.id, item_count: plan.rescue.length })
          await goTo(token, plan.steps, 'rescue')
        } catch (error) {
          track('Rescue items error', { collectionId: collection.id, error: errorCode(error) })
          fail(token, 'rescue', error)
        }
      }),
    [once, collection, plan, chainId, txSender, wait, fetchItems, goTo, fail]
  )

  const runDeploy = useMemo(
    () =>
      once('deploy', async token => {
        const items = plan.deploy
        const uploading = (done: number) => progress(token, 'deploy', { kind: 'uploading', done, total: items.length })
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
      }),
    [once, collection, plan, address, goTo, fail, progress]
  )

  const runApprove = useMemo(
    () =>
      once('approve', async token => {
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
      }),
    [once, collection, address, chainId, txSender, wait, complete, fail, queryClient]
  )

  /**
   * Backs out of the wallet prompt: the step screen comes back, but the request stays open in the wallet. Signing it
   * anyway carries the step on; confirming the step again shows the open request instead of sending a second one.
   */
  const cancelSigning = useCallback(() => {
    if (view.kind !== 'step') return
    dismissed.current = true
    setView({ kind: 'step', step: view.step, phase: IDLE })
  }, [view])

  /** The creator's edits reach the editor, so the curator reviews them before approving. */
  const reloadItems = useCallback(
    () => queryClient.invalidateQueries({ queryKey: allCollectionItemsKey(address, collection.id) }),
    [queryClient, address, collection.id]
  )

  const stop = useCallback(() => {
    run.current++
  }, [])

  return { view, plan, running, start, runRescue, runDeploy, runApprove, cancelSigning, reloadItems, stop }
}
