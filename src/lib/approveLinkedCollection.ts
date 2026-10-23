// The committee's approval flow for a linked (third-party) collection, ported from the legacy builder's
// handleInitiateTPItemsApprovalFlow and its batched deploy: the pending items' curated hashes form the third
// party's Merkle tree; its root goes on chain (consuming the creator's slots cheque), then each item's entity is
// deployed with its proof and its curation approved. Every step is idempotent, so a failed run can be resumed.
import { type ContractCall, type TransactionSettlement } from '~/lib/auth'
import { type LinkedApprovalData } from '~/lib/builder'
import {
  ApprovalError,
  INDEXER_TIMEOUT_MS,
  buildMissingImage,
  waitForIndexer,
  type DeployDeps,
  type DeployFailure
} from '~/lib/approveCollection'
import {
  buildDeploymentForm,
  buildLinkedItemEntity,
  computeLinkedItemContentHash,
  getEntityContent,
  type LinkedMerkleProof
} from '~/lib/catalystEntity'
import { CurationStatus, type Collection } from '~/lib/collections'
import { type ItemCuration } from '~/lib/linkedItemStatus'
import { type Item } from '~/lib/items'
import { type ThirdParty } from '~/lib/thirdParty'
import { buildReviewThirdPartyWithRootCall, toChequeSlot, type ChequeSlot } from '~/lib/thirdPartyRegistry'

// Governance proposal f69c4d40-aaaf-11ec-87a7-6d2a41508231: a sample of 1% of the items, between 50 and 300.
export const MIN_ITEMS_TO_REVIEW = 50
export const MAX_ITEMS_TO_REVIEW = 300
const REVIEW_RATIO = 0.01

/** How many of `totalItems` a curator must review before approving (legacy getTPThresholdToReview). */
export function getReviewThreshold(totalItems: number): number {
  if (totalItems < MIN_ITEMS_TO_REVIEW) return totalItems
  return Math.min(MAX_ITEMS_TO_REVIEW, Math.max(MIN_ITEMS_TO_REVIEW, Math.ceil(totalItems * REVIEW_RATIO)))
}

export type LinkedApprovalPlan = {
  pendingItems: Item[]
  approvalData: LinkedApprovalData
  /** Root of the tree over every curated hash of the collection, the one the chain must hold before deploying. */
  merkleRoot: string
  /** Whether the chain holds another root: false on a retry whose root transaction already went through. */
  needsRoot: boolean
  /** The cheque to consume with the root; empty once it was consumed (a retry, or pushed changes that bought nothing). */
  slots: ChequeSlot[]
  proofOf: (itemId: string) => LinkedMerkleProof
}

export type PrepareDeps = {
  fetchPendingItems: (collectionId: string) => Promise<Item[]>
  fetchApprovalData: (collectionId: string) => Promise<LinkedApprovalData>
  /** The latest curation of every item, to keep rejected or superseded content out of the root. */
  fetchItemCurations: (collectionId: string) => Promise<Map<string, ItemCuration>>
  /** The root the registry holds now: builder-server's copy lags it right after a root transaction. */
  fetchRegistryRoot: () => Promise<string>
}

/** What the curator saw: the pending items when they decided, and the content of each item they opened. */
export type ReviewedContent = {
  pendingIds: Set<string>
  /** Content hash of each opened item, by id, as it was when opened. */
  reviewedHashes: Map<string, string | undefined>
}

/**
 * Whether the server's pending items are still the ones the curator reviewed: the same set, less any approved since
 * (a retry after some deployed), and every opened item with the content it had. Otherwise the committee would sign a
 * root over content nobody looked at.
 */
export function matchesReviewedContent(
  pendingItems: Item[],
  review: ReviewedContent,
  curations: Map<string, ItemCuration> = new Map()
): boolean {
  const stillPending = (id: string) => curations.get(id)?.status !== CurationStatus.APPROVED
  const expected = [...review.pendingIds].filter(stillPending)
  if (pendingItems.length !== expected.length) return false
  const byId = new Map(pendingItems.map(item => [item.id, item]))
  if (expected.some(id => !byId.has(id))) return false
  return [...review.reviewedHashes]
    .filter(([id]) => stillPending(id))
    .every(([id, hash]) => byId.get(id)?.currentContentHash === hash)
}

const sameRoot = (a: string | null, b: string) => a?.toLowerCase() === b.toLowerCase()

/** Only reached from the approval flow: the tree package and the Node Buffer it expects stay out of the first load. */
async function generateTree(hashes: string[]) {
  const scope = globalThis as { Buffer?: unknown }
  if (!scope.Buffer) scope.Buffer = (await import('buffer')).Buffer
  const { generateTree } = await import('@dcl/content-hash-tree')
  return generateTree(hashes)
}

/**
 * What the approval needs: the pending items, their proofs and whether the root transaction is due. The cheque
 * must cover the items the Catalyst doesn't hold yet, since items pushed again don't take a slot.
 */
export async function prepareLinkedApproval(
  collection: Collection,
  deps: PrepareDeps,
  review?: ReviewedContent
): Promise<LinkedApprovalPlan> {
  const [pendingItems, approvalData, curations, registryRoot] = await Promise.all([
    deps.fetchPendingItems(collection.id),
    deps.fetchApprovalData(collection.id),
    deps.fetchItemCurations(collection.id),
    deps.fetchRegistryRoot()
  ])
  if (pendingItems.length === 0) throw new ApprovalError('nothing_pending', 'The collection has no items to approve')
  if (review && !matchesReviewedContent(pendingItems, review, curations)) {
    throw new ApprovalError('changed', 'The pending items changed since they were reviewed')
  }
  const unhashed = pendingItems.find(item => !approvalData.contentHashes[item.id])
  if (unhashed) throw new ApprovalError('missing_hash', `Item ${unhashed.id} has no curated content hash`)
  // The root goes on chain before anything is deployed, so every pending leaf must be the content the curator has on
  // screen: the hash the curation recorded, the item's current hash and the hash of the item itself must all agree.
  // An item saved after it was submitted can't be approved until the creator submits it again: reviewing won't help.
  const unsubmitted = pendingItems.find(item => approvalData.contentHashes[item.id] !== item.currentContentHash)
  if (unsubmitted) throw new ApprovalError('unsubmitted', `Item ${unsubmitted.id} has changes that were not submitted`)
  const drifted = pendingItems.find(
    item => approvalData.contentHashes[item.id] !== computeLinkedItemContentHash(collection, item)
  )
  if (drifted) throw new ApprovalError('changed', `Item ${drifted.id} changed since it was curated`)

  const newItems = pendingItems.filter(item => !item.isApproved).length

  // Only approved content and the pending content verified above may be provable: a rejected or superseded hash in
  // the root would let content nobody approved reach the Catalyst.
  const pendingIds = new Set(pendingItems.map(item => item.id))
  const leaves = Object.entries(approvalData.contentHashes)
    .filter(([id]) => pendingIds.has(id) || curations.get(id)?.status === CurationStatus.APPROVED)
    .map(([, hash]) => hash)
  const tree = await generateTree(leaves)
  // A root the registry already holds was set by an earlier attempt, which consumed the cheque with it.
  const needsRoot = !sameRoot(registryRoot || approvalData.root, tree.merkleRoot)
  if (needsRoot && !approvalData.chequeWasConsumed && approvalData.cheque.qty < newItems) {
    throw new ApprovalError('invalid_cheque', `The cheque covers ${approvalData.cheque.qty} items, ${newItems} are new`)
  }
  return {
    pendingItems,
    approvalData,
    merkleRoot: tree.merkleRoot,
    needsRoot,
    slots: approvalData.chequeWasConsumed || !needsRoot ? [] : [toChequeSlot(approvalData.cheque)],
    proofOf: itemId => {
      const entityHash = approvalData.contentHashes[itemId]
      const leaf = tree.proofs[entityHash]
      if (!leaf) throw new ApprovalError('missing_hash', `Item ${itemId} is not in the Merkle tree`)
      return { index: leaf.index, proof: leaf.proof, entityHash }
    }
  }
}

export type RootDeps = {
  chainId: number
  sendTransaction: (call: ContractCall) => Promise<string>
  settleTransaction: (txHash: string) => Promise<TransactionSettlement>
  fetchThirdParty: (thirdPartyId: string) => Promise<ThirdParty>
  sleep?: (ms: number) => Promise<void>
}

/** Puts the plan's root on chain, consuming the cheque, and waits until builder-server reads it back. */
export async function setLinkedMerkleRoot(
  thirdPartyId: string,
  plan: LinkedApprovalPlan,
  deps: RootDeps,
  timeoutMs = INDEXER_TIMEOUT_MS
): Promise<string> {
  const call = buildReviewThirdPartyWithRootCall(deps.chainId, thirdPartyId, plan.merkleRoot, plan.slots)
  const txHash = await deps.sendTransaction(call)
  const outcome = await deps.settleTransaction(txHash)
  if (outcome === 'reverted') throw new ApprovalError('reverted', `Merkle root ${txHash} reverted`)
  if (outcome === 'pending') throw new ApprovalError('not_indexed', `Merkle root ${txHash} is still pending`)
  // A dropped transaction may have been sped up under another hash: the root then shows up all the same.
  await waitForIndexer(
    () => deps.fetchThirdParty(thirdPartyId),
    thirdParty => sameRoot(thirdParty.root, plan.merkleRoot),
    timeoutMs,
    deps.sleep
  )
  return txHash
}

/**
 * Where an item's deployment failed: building its entity, the Catalyst upload, or approving its curation; `changed`
 * when the creator saved it during the approval, which leaves it pending for another review.
 */
export type LinkedDeployStage = 'build' | 'deploy' | 'curation' | 'changed'
export type LinkedDeployFailure = DeployFailure & { stage: LinkedDeployStage }
export type LinkedDeployResult = { deployed: Item[]; failed: LinkedDeployFailure[] }

export type LinkedDeployDeps = DeployDeps & {
  /** The item as the server holds it now, to catch an edit the creator saves while the approval runs. */
  fetchItem: (itemId: string) => Promise<Item>
  approveItem: (itemId: string) => Promise<unknown>
  concurrency?: number
}

export const DEPLOY_CONCURRENCY = 5

class StageError extends Error {
  constructor(
    public stage: LinkedDeployStage,
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'StageError'
  }
}

async function atStage<T>(stage: LinkedDeployStage, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof ApprovalError && (error.reason === 'no_identity' || error.reason === 'changed')) throw error
    throw new StageError(stage, error)
  }
}

async function deployLinkedItem(
  collection: Collection,
  item: Item,
  plan: LinkedApprovalPlan,
  deps: LinkedDeployDeps
): Promise<void> {
  const proof = await atStage('build', () => Promise.resolve().then(() => plan.proofOf(item.id)))
  // builder-server approves whatever content the item has when asked, so an edit saved mid-run must stop it here.
  const assertUnchanged = () =>
    atStage('changed', async () => {
      const current = await deps.fetchItem(item.id)
      if (current.currentContentHash !== proof.entityHash) {
        throw new Error(`Item ${item.id} changed during the approval`)
      }
    })
  const { entity, authChain, content, image } = await atStage('build', async () => {
    const image = await buildMissingImage(item, deps)
    const content = getEntityContent(item, image?.hash)
    // Never sign an entity whose content isn't the one curated into the root.
    if (computeLinkedItemContentHash(collection, item) !== proof.entityHash) {
      throw new ApprovalError('changed', `Item ${item.id} changed since it was curated`)
    }
    const entity = await buildLinkedItemEntity(collection, item, content, proof)
    const authChain = deps.sign(entity.entityId)
    if (!authChain) throw new ApprovalError('no_identity', 'The session has no signing identity')
    return { entity, authChain, content, image }
  })
  await assertUnchanged()
  await atStage('deploy', async () => {
    const hashes = [...new Set(Object.values(content))]
    const available = await deps.fetchAvailableContent(hashes)
    const files = new Map<string, Blob>()
    for (const hash of hashes) {
      if (available.has(hash)) continue
      files.set(hash, image && hash === image.hash ? image.blob : await deps.fetchContent(hash))
    }
    await deps.deployEntity(buildDeploymentForm(entity, authChain, files))
  })
  await assertUnchanged()
  await atStage('curation', () => deps.approveItem(item.id))
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  work: (item: T, isStopped: () => boolean) => Promise<void>
): Promise<void> {
  let next = 0
  // One lane failing for good (no signing identity) stops the others from taking more items; the error is rethrown
  // only once every lane is idle, so a retry never overlaps work still running.
  let failure: { error: unknown } | null = null
  const isStopped = () => failure !== null
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (!failure && next < items.length) {
      try {
        await work(items[next++], isStopped)
      } catch (error) {
        failure ??= { error }
      }
    }
  })
  await Promise.all(lanes)
  if (failure) throw (failure as { error: unknown }).error
}

/**
 * Deploys every pending item's entity and approves its curation, a few at a time. One failure doesn't stop the
 * rest: the caller shows them by stage and retries, since only the failed ones stay pending.
 */
export async function deployLinkedItems(
  collection: Collection,
  plan: LinkedApprovalPlan,
  deps: LinkedDeployDeps,
  onProgress?: (done: number, total: number) => void
): Promise<LinkedDeployResult> {
  const items = plan.pendingItems
  const result: LinkedDeployResult = { deployed: [], failed: [] }
  await runPool(items, deps.concurrency ?? DEPLOY_CONCURRENCY, async (item, isStopped) => {
    try {
      await deployLinkedItem(collection, item, plan, deps)
      result.deployed.push(item)
    } catch (error) {
      if (!(error instanceof StageError)) throw error
      result.failed.push({ item, stage: error.stage, message: error.message })
    }
    // After a fatal error the caller shows it: progress from lanes still finishing must not replace it.
    if (!isStopped()) onProgress?.(result.deployed.length + result.failed.length, items.length)
  })
  return result
}
