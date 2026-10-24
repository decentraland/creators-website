import { ContractName, getContract } from 'decentraland-transactions'
import { type ContractCall } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { isCollectionOwner } from '~/lib/collectionRoles'
import { SellItemError } from '~/lib/sales'

export type NewOwnerError = 'self'

/** Why an address can't become the new owner, if it can't. */
export function getNewOwnerError(collection: Collection, address: string): NewOwnerError | null {
  return isCollectionOwner(collection, address) ? 'self' : null
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

/** The collection as builder-server will report it once the subgraph catches up with the transfer. */
export function withOwner(collection: Collection, newOwner: string): Collection {
  return { ...collection, owner: newOwner.toLowerCase() }
}
