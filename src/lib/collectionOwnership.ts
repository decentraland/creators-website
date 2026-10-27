import { ContractName, getContract } from 'decentraland-transactions'
import { type ContractCall } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { getSystemMinters, isCollectionOwner } from '~/lib/collectionRoles'
import { CONSOLIDATE_RETRIES, CONSOLIDATE_RETRY_DELAY_MS } from '~/lib/publishCollection'
import { SellItemError } from '~/lib/sales'

export type NewOwnerError = 'self' | 'zero' | 'system'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Why an address can't become the new owner, if it can't: a transfer to a contract can't be undone. */
export function getNewOwnerError(collection: Collection, address: string, chainId: number): NewOwnerError | null {
  const target = address.toLowerCase()
  if (isCollectionOwner(collection, target)) return 'self'
  if (target === ZERO_ADDRESS) return 'zero'
  if (getSystemMinters(chainId).has(target)) return 'system'
  return null
}

/** Whether the typed confirmation is the collection's name; surrounding spaces and case don't count. */
export function matchesCollectionName(collection: Collection, typed: string): boolean {
  return typed.trim().toLowerCase() === collection.name.trim().toLowerCase()
}

/** `transferCreatorship(address)` on the collection contract itself; the on-chain creator is the UI's owner. */
export function buildTransferOwnershipCall(collection: Collection, newOwner: string, chainId: number): ContractCall {
  if (!collection.contractAddress) throw new SellItemError('not_published', 'The collection has no contract yet')
  const contract = { ...getContract(ContractName.ERC721CollectionV2, chainId), address: collection.contractAddress }
  return { contract, method: 'transferCreatorship', args: [newOwner] }
}

export type OwnerSyncDeps = {
  syncCollectionOwner: (collectionId: string) => Promise<Collection>
}

/**
 * Asks builder-server to store the new owner until it reports it: the subgraph lags the transaction,
 * and a request that fails in between is retried too, as the transfer itself can't be undone.
 */
export async function waitForOwnerSync(
  collectionId: string,
  newOwner: string,
  deps: OwnerSyncDeps,
  retries = CONSOLIDATE_RETRIES,
  retryDelayMs = CONSOLIDATE_RETRY_DELAY_MS
): Promise<Collection> {
  const owner = newOwner.toLowerCase()
  for (let attempt = 0; ; attempt++) {
    try {
      const collection = await deps.syncCollectionOwner(collectionId)
      if (collection.owner.toLowerCase() === owner) return collection
      if (attempt >= retries) throw new SellItemError('generic', 'The transfer was not indexed in time')
    } catch (error) {
      if (attempt >= retries) throw error
    }
    await new Promise(resolve => setTimeout(resolve, retryDelayMs))
  }
}
