// The committee's approval flow for a standard collection, ported from the legacy builder's
// handleInitiateApprovalFlow: token ids → rescue content hashes on chain → deploy entities → approve.
// Every step is idempotent, so running the flow again resumes where a closed or failed run stopped.
import { hashV1 } from '@dcl/hashing'
import { type Entity } from '@dcl/schemas'
import { type ContractCall } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { buildRescueItemsCalls, buildSetApprovedCall } from '~/lib/collectionApproval'
import {
  buildDeploymentForm,
  buildItemEntity,
  computeItemContentHash,
  getEntityContent,
  type AuthLink,
  type EntityContent
} from '~/lib/catalystEntity'
import { isItemSynced } from '~/lib/itemSync'
import { IMAGE_PATH, ItemType, getItemMetadata, type Item } from '~/lib/items'

export type RescueTarget = { item: Item; contentHash: string }

/** A generated `image.png` for an item saved without one (legacy generateCatalystImage). */
export type MissingImage = { hash: string; blob: Blob }

export type ImageDeps = {
  fetchContent: (hash: string) => Promise<Blob>
  renderCatalystImage: (thumbnail: Blob, rarity: string) => Promise<Blob>
}

export async function buildMissingImage(item: Item, deps: ImageDeps): Promise<MissingImage | null> {
  if (item.contents[IMAGE_PATH]) return null
  const thumbnail = await deps.fetchContent(item.contents[item.thumbnail])
  const blob = await deps.renderCatalystImage(thumbnail, item.rarity ?? '')
  return { hash: await hashV1(new Uint8Array(await blob.arrayBuffer())), blob }
}

export class ApprovalError extends Error {
  reason: 'reverted' | 'not_indexed' | 'no_identity' | 'deploy_failed'

  constructor(reason: ApprovalError['reason'], message: string) {
    super(message)
    this.name = 'ApprovalError'
    this.reason = reason
  }
}

export type TokenIdDeps = {
  publishCollectionItems: () => Promise<unknown>
  fetchItems: () => Promise<Item[]>
}

/** Items of a collection whose creator left before the publish finished have no token id; the server backfills them. */
export async function ensureTokenIds(items: Item[], deps: TokenIdDeps): Promise<Item[]> {
  if (items.every(item => item.tokenId)) return items
  await deps.publishCollectionItems()
  return deps.fetchItems()
}

/**
 * Published items whose on-chain content hash no longer matches the builder copy. Emotes and items with
 * no server-computed hash are hashed here, in both formats, since older items may carry the Qm one.
 */
export async function findItemsToRescue(
  collection: Collection,
  items: Item[],
  imageOf: (item: Item) => Promise<MissingImage | null>
): Promise<RescueTarget[]> {
  const targets: RescueTarget[] = []
  for (const item of items) {
    if (!item.currentContentHash || item.type === ItemType.EMOTE) {
      const content = getEntityContent(item, (await imageOf(item))?.hash)
      const [v0, v1] = await Promise.all([
        computeItemContentHash(collection, item, content, 'v0'),
        computeItemContentHash(collection, item, content, 'v1')
      ])
      if (v0 !== item.blockchainContentHash && v1 !== item.blockchainContentHash) {
        targets.push({ item, contentHash: v1 })
      }
    } else if (item.currentContentHash !== item.blockchainContentHash) {
      targets.push({ item, contentHash: item.currentContentHash })
    }
  }
  return targets
}

export type RescueDeps = {
  chainId: number
  sendTransaction: (call: ContractCall) => Promise<string>
  waitForTransaction: (txHash: string) => Promise<boolean>
  fetchItems: () => Promise<Item[]>
  sleep?: (ms: number) => Promise<void>
  onChunkSent?: (index: number, total: number, txHash: string) => void
}

const INDEXER_POLL_MS = 2000
const INDEXER_TIMEOUT_MS = 10 * 60_000

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Rewrites the stale hashes on chain, one transaction per chunk, then waits until builder-server reads the new ones. */
export async function rescueItems(
  collection: Collection,
  targets: RescueTarget[],
  deps: RescueDeps,
  timeoutMs = INDEXER_TIMEOUT_MS
): Promise<Item[]> {
  const entries = targets.map(({ item, contentHash }) => ({
    tokenId: item.tokenId!,
    contentHash,
    metadata: getItemMetadata(item)
  }))
  const calls = buildRescueItemsCalls(deps.chainId, collection, entries)
  for (const [index, call] of calls.entries()) {
    const txHash = await deps.sendTransaction(call)
    deps.onChunkSent?.(index, calls.length, txHash)
    if (!(await deps.waitForTransaction(txHash))) throw new ApprovalError('reverted', `Rescue ${txHash} reverted`)
  }

  const expected = new Map(targets.map(({ item, contentHash }) => [item.id, contentHash]))
  const sleep = deps.sleep ?? defaultSleep
  for (let waited = 0; waited <= timeoutMs; waited += INDEXER_POLL_MS) {
    const items = await deps.fetchItems()
    const indexed = items.every(item => !expected.has(item.id) || item.blockchainContentHash === expected.get(item.id))
    if (indexed) return items
    await sleep(INDEXER_POLL_MS)
  }
  throw new ApprovalError('not_indexed', 'The rescued hashes were not indexed in time')
}

/** Published items whose Catalyst entity is missing or differs from the builder copy. */
export function findItemsToDeploy(items: Item[], entities: Entity[]): Item[] {
  const byPointer = new Map<string, Entity>()
  for (const entity of entities) {
    for (const pointer of entity.pointers) byPointer.set(pointer.toLowerCase(), entity)
  }
  return items.filter(item => {
    if (!item.urn) return false
    const entity = byPointer.get(item.urn.toLowerCase())
    return !entity || !isItemSynced(item, entity)
  })
}

export type DeployDeps = ImageDeps & {
  sign: (entityId: string) => AuthLink[] | null
  fetchAvailableContent: (hashes: string[]) => Promise<Set<string>>
  deployEntity: (form: FormData) => Promise<void>
}

async function deployItem(collection: Collection, item: Item, deps: DeployDeps): Promise<void> {
  const image = await buildMissingImage(item, deps)
  const content: EntityContent = getEntityContent(item, image?.hash)
  const entity = await buildItemEntity(collection, item, content)
  const authChain = deps.sign(entity.entityId)
  if (!authChain) throw new ApprovalError('no_identity', 'The session has no signing identity')

  const hashes = [...new Set(Object.values(content))]
  const available = await deps.fetchAvailableContent(hashes)
  const files = new Map<string, Blob>()
  for (const hash of hashes) {
    if (available.has(hash)) continue
    files.set(hash, image && hash === image.hash ? image.blob : await deps.fetchContent(hash))
  }
  await deps.deployEntity(buildDeploymentForm(entity, authChain, files, available))
}

export type DeployResult = { deployed: Item[]; failed: Item[] }

/** Deploys every item's entity; one failure doesn't stop the rest, the caller retries the failed ones. */
export async function deployItems(
  collection: Collection,
  items: Item[],
  deps: DeployDeps,
  onProgress?: (done: number, total: number) => void
): Promise<DeployResult> {
  const result: DeployResult = { deployed: [], failed: [] }
  for (const item of items) {
    try {
      await deployItem(collection, item, deps)
      result.deployed.push(item)
    } catch (error) {
      if (error instanceof ApprovalError && error.reason === 'no_identity') throw error
      console.error(`Deploying ${item.id} failed:`, error)
      result.failed.push(item)
    }
    onProgress?.(result.deployed.length + result.failed.length, items.length)
  }
  return result
}

export type ApproveDeps = {
  chainId: number
  sendTransaction: (call: ContractCall) => Promise<string>
  waitForTransaction: (txHash: string) => Promise<boolean>
}

/** Makes the collection mintable (also "Enable" for a disabled one). */
export async function approveOnChain(collection: Collection, deps: ApproveDeps): Promise<string> {
  const txHash = await deps.sendTransaction(buildSetApprovedCall(deps.chainId, collection, true))
  if (!(await deps.waitForTransaction(txHash))) throw new ApprovalError('reverted', `Approval ${txHash} reverted`)
  return txHash
}
