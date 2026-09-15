import { ContractName, getContract } from 'decentraland-transactions'
import { type ContractCall } from '~/lib/auth'
import { hasBeenApproved, type Collection } from '~/lib/collections'
import { getItemSales, type Item } from '~/lib/items'
import { SellItemError } from '~/lib/sales'

// Same cap as the legacy builder's MAX_NFTS_PER_MINT: issueTokens runs out of gas past it.
export const MAX_ITEMS_PER_SEND = 50

/** One bundle: every recipient gets `amounts[itemId]` copies of each item. */
export type Transfer = {
  recipients: string[]
  amounts: Record<string, number>
}

/** A transfer being edited: `key` keeps each card's React state with its own transfer when one is removed. */
export type TransferDraft = Transfer & { key: number }

let nextTransferKey = 0

export function createTransfer(): TransferDraft {
  return { key: nextTransferKey++, recipients: [], amounts: {} }
}

/** Only the owner and minters may call issueTokens; collaborators would get a reverted transaction. */
export function canSendCollectionItems(collection: Collection, address: string | undefined): boolean {
  if (!address || !hasBeenApproved(collection)) return false
  const target = address.toLowerCase()
  return collection.owner.toLowerCase() === target || collection.minters.some(m => m.toLowerCase() === target)
}

/** Published and approved on chain: sold-out items are listed disabled, so they stay sendable here. */
export function isSendableItem(item: Item): boolean {
  return item.isPublished && item.isApproved && !!item.tokenId && getItemSales(item) !== undefined
}

/**
 * Copies not yet minted, before this dialog's allocations. Read from the item as loaded with the page:
 * a mint landing in the meantime makes the contract revert, which the flow reports as a generic error.
 */
export function getStock(item: Item): { available: number; total: number } {
  const sales = getItemSales(item)
  if (!sales) return { available: 0, total: 0 }
  return { available: sales.maxSupply - sales.minted, total: sales.maxSupply }
}

export function totalCopies(transfers: Transfer[]): number {
  return transfers.reduce(
    (sum, { recipients, amounts }) => sum + recipients.length * Object.values(amounts).reduce((a, b) => a + b, 0),
    0
  )
}

/** Copies of `itemId` claimed by every transfer other than `except`. */
export function allocatedElsewhere(transfers: Transfer[], itemId: string, except?: number): number {
  return transfers.reduce(
    (sum, transfer, index) =>
      index === except ? sum : sum + transfer.recipients.length * (transfer.amounts[itemId] ?? 0),
    0
  )
}

/** Most copies per recipient a transfer may still set for an item (a recipient-less transfer counts as one). */
export function maxAmount(item: Item, transfers: Transfer[], index: number): number {
  const remaining = getStock(item).available - allocatedElsewhere(transfers, item.id, index)
  return Math.max(0, Math.floor(remaining / Math.max(1, transfers[index].recipients.length)))
}

export type RecipientBundle = { address: string; amounts: Record<string, number> }

/** What each wallet ends up with once every transfer is merged: an address in two transfers gets both bundles. */
export function copiesPerRecipient(transfers: Transfer[]): RecipientBundle[] {
  const bundles = new Map<string, Record<string, number>>()
  for (const transfer of transfers) {
    const chosen = Object.entries(transfer.amounts).filter(([, amount]) => amount > 0)
    if (chosen.length === 0) continue
    for (const address of transfer.recipients) {
      const amounts = bundles.get(address) ?? {}
      for (const [itemId, amount] of chosen) amounts[itemId] = (amounts[itemId] ?? 0) + amount
      bundles.set(address, amounts)
    }
  }
  return [...bundles].map(([address, amounts]) => ({ address, amounts }))
}

/**
 * The parallel `issueTokens(beneficiaries, itemIds)` arrays: one entry per copy. Re-checks the cap the UI
 * enforces so a programming error can't pay gas for a transaction bound to run out of it.
 */
export function flattenTransfers(
  transfers: Transfer[],
  items: Item[]
): { beneficiaries: string[]; tokenIds: string[] } {
  const tokenIdOf = new Map(items.map(item => [item.id, item.tokenId]))
  const beneficiaries: string[] = []
  const tokenIds: string[] = []
  for (const transfer of transfers) {
    for (const recipient of transfer.recipients) {
      for (const [itemId, amount] of Object.entries(transfer.amounts)) {
        const tokenId = tokenIdOf.get(itemId)
        if (!tokenId) throw new SellItemError('not_published', `Item ${itemId} has no token id`)
        for (let i = 0; i < amount; i++) {
          beneficiaries.push(recipient)
          tokenIds.push(tokenId)
        }
      }
    }
  }
  if (beneficiaries.length > MAX_ITEMS_PER_SEND) {
    throw new SellItemError('generic', `Cannot send more than ${MAX_ITEMS_PER_SEND} items at once`)
  }
  return { beneficiaries, tokenIds }
}

export function buildIssueTokensCall(
  collection: Collection,
  beneficiaries: string[],
  tokenIds: string[],
  chainId: number
): ContractCall {
  if (!collection.contractAddress) throw new SellItemError('not_published', 'The collection has no contract yet')
  const contract = { ...getContract(ContractName.ERC721CollectionV2, chainId), address: collection.contractAddress }
  return { contract, method: 'issueTokens', args: [beneficiaries, tokenIds] }
}

/** Copies per item across every transfer, to bump `totalSupply` once the transaction is mined. */
export function copiesPerItem(transfers: Transfer[]): Record<string, number> {
  const copies: Record<string, number> = {}
  for (const transfer of transfers) {
    for (const [itemId, amount] of Object.entries(transfer.amounts)) {
      copies[itemId] = (copies[itemId] ?? 0) + transfer.recipients.length * amount
    }
  }
  return copies
}
