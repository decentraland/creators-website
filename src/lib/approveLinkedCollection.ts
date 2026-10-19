// The committee's approval flow for a linked (third-party) collection, ported from the legacy builder's
// handleInitiateTPItemsApprovalFlow and its batched deploy: the pending items' curated hashes form the third
// party's Merkle tree; its root goes on chain (consuming the creator's slots cheque), then each item's entity is
// deployed with its proof and its curation approved. Every step is idempotent, so a failed run can be resumed.
import { type ContractCall } from '~/lib/auth'
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
  getEntityContent,
  type LinkedMerkleProof
} from '~/lib/catalystEntity'
import { type Collection } from '~/lib/collections'
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
export async function prepareLinkedApproval(collection: Collection, deps: PrepareDeps): Promise<LinkedApprovalPlan> {
  const [pendingItems, approvalData] = await Promise.all([
    deps.fetchPendingItems(collection.id),
    deps.fetchApprovalData(collection.id)
  ])
  if (pendingItems.length === 0) throw new ApprovalError('nothing_pending', 'The collection has no items to approve')
  const unhashed = pendingItems.find(item => !approvalData.contentHashes[item.id])
  if (unhashed) throw new ApprovalError('missing_hash', `Item ${unhashed.id} has no curated content hash`)

  const newItems = pendingItems.filter(item => !item.isApproved).length
  if (!approvalData.chequeWasConsumed && approvalData.cheque.qty < newItems) {
    throw new ApprovalError('invalid_cheque', `The cheque covers ${approvalData.cheque.qty} items, ${newItems} are new`)
  }

  const tree = await generateTree(Object.values(approvalData.contentHashes))
  return {
    pendingItems,
    approvalData,
    merkleRoot: tree.merkleRoot,
    needsRoot: !sameRoot(approvalData.root, tree.merkleRoot),
    slots: approvalData.chequeWasConsumed ? [] : [toChequeSlot(approvalData.cheque)],
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
  waitForTransaction: (txHash: string) => Promise<boolean>
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
  if (!(await deps.waitForTransaction(txHash))) throw new ApprovalError('reverted', `Merkle root ${txHash} reverted`)
  await waitForIndexer(
    () => deps.fetchThirdParty(thirdPartyId),
    thirdParty => sameRoot(thirdParty.root, plan.merkleRoot),
    timeoutMs,
    deps.sleep
  )
  return txHash
}

/** Where an item's deployment failed: building its entity, the Catalyst upload, or approving its curation. */
export type LinkedDeployStage = 'build' | 'deploy' | 'curation'
export type LinkedDeployFailure = DeployFailure & { stage: LinkedDeployStage }
export type LinkedDeployResult = { deployed: Item[]; failed: LinkedDeployFailure[] }

export type LinkedDeployDeps = DeployDeps & {
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
    if (error instanceof ApprovalError && error.reason === 'no_identity') throw error
    throw new StageError(stage, error)
  }
}

async function deployLinkedItem(
  collection: Collection,
  item: Item,
  plan: LinkedApprovalPlan,
  deps: LinkedDeployDeps
): Promise<void> {
  const { entity, authChain, content, image } = await atStage('build', async () => {
    const image = await buildMissingImage(item, deps)
    const content = getEntityContent(item, image?.hash)
    const entity = await buildLinkedItemEntity(collection, item, content, plan.proofOf(item.id))
    const authChain = deps.sign(entity.entityId)
    if (!authChain) throw new ApprovalError('no_identity', 'The session has no signing identity')
    return { entity, authChain, content, image }
  })
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
  await atStage('curation', () => deps.approveItem(item.id))
}

async function runPool<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) await work(items[next++])
  })
  await Promise.all(lanes)
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
  await runPool(items, deps.concurrency ?? DEPLOY_CONCURRENCY, async item => {
    try {
      await deployLinkedItem(collection, item, plan, deps)
      result.deployed.push(item)
    } catch (error) {
      if (!(error instanceof StageError)) throw error
      result.failed.push({ item, stage: error.stage, message: error.message })
    }
    onProgress?.(result.deployed.length + result.failed.length, items.length)
  })
  return result
}
