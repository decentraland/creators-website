import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type TradeCreation } from '@dcl/schemas'
import { readContract, signTypedData, type Session } from '~/lib/auth'
import { type ActivityEventInput, type TransactionCalls } from '~/lib/activity'
import { useTrackedTransactionCalls } from '~/hooks/useActivity'
import { type Collection } from '~/lib/collections'
import { fetchFriends } from '~/lib/friends'
import { type Item } from '~/lib/items'
import { fetchItemTradeId, type ItemListing } from '~/lib/listings'
import { buildIssueTokensCall, copiesPerItem, flattenTransfers, totalCopies, type Transfer } from '~/lib/mint'
import { getMaticChainId } from '~/lib/publishCollection'
import {
  buildEnableSalesCall,
  isSalesEnabled,
  removeListing,
  removeStoreListing,
  sellItem,
  SellItemError,
  updatePrice,
  withSalesEnabled,
  type ListingTerms,
  type SalePrice
} from '~/lib/sales'
import {
  OFFCHAIN_MARKETPLACE_TYPES,
  createTrade,
  fetchSignatureIndexes,
  fetchTrade,
  getTradeDomain,
  toTradeTypedValues,
  type UnsignedTrade
} from '~/lib/trades'

// Collections whose sales this tab enabled: builder-server reports minters from the subgraph, which
// lags the transaction by a while, so a refetch in between must not bring the Enable Sales step back.
// Never evicted: this app cannot remove the minter, so only a full reload picks up an external removal.
const enabledInSession = new Set<string>()

export function useSalesEnabled(collection: Collection): boolean {
  return enabledInSession.has(collection.id) || isSalesEnabled(collection, getMaticChainId())
}

export type EnableSalesVariables = {
  collection: Collection
  /** The wallet prompt is over; the transaction is mining. */
  onSigned?: () => void
}

/** Makes the off-chain marketplace a minter of the collection and waits until the change is mined. */
export function useEnableSales(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  const tracked = useTrackedTransactionCalls(session)
  return useMutation({
    mutationFn: async ({ collection, onSigned }: EnableSalesVariables): Promise<Collection> => {
      if (!session) throw new Error('Wallet disconnected')
      const calls = tracked({ type: 'enable_sales', collectionId: collection.id, collectionName: collection.name })
      const txHash = await calls.sendTransaction(buildEnableSalesCall(collection, chainId))
      onSigned?.()
      const mined = await calls.waitForTransaction(txHash)
      if (!mined) throw new SellItemError('generic', 'The enable sales transaction reverted')
      return withSalesEnabled(collection, chainId)
    },
    onSuccess: collection => {
      enabledInSession.add(collection.id)
      queryClient.setQueryData(['collection', session?.address, collection.id], collection)
    }
  })
}

export type SellItemVariables = {
  collection: Collection
  item: Item
  price: SalePrice
  beneficiary: string
  expiresAt: number
  /** The wallet prompt is over; the order is being stored. */
  onSigned?: () => void
}

// The wallet-facing half of signing and storing an order, shared by selling and re-pricing. The chain
// calls come in already reporting to the activity log under the flow's description.
function orderDeps(session: Session, chainId: number, calls: TransactionCalls) {
  return {
    fetchTrade,
    fetchItemTradeId,
    fetchSignatureIndexes,
    ...calls,
    signTrade: (trade: UnsignedTrade) =>
      signTypedData(session, getTradeDomain(chainId), OFFCHAIN_MARKETPLACE_TYPES, toTradeTypedValues(trade)),
    createTrade: (trade: TradeCreation) => createTrade(session.address, trade)
  }
}

/** Signs the item's primary order and stores it; the collection's listings pick it up right away. */
export function useSellItem(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  const tracked = useTrackedTransactionCalls(session)
  return useMutation({
    mutationFn: async ({ onSigned, ...variables }: SellItemVariables): Promise<ItemListing> => {
      if (!session) throw new Error('Wallet disconnected')
      // Selling signs an off-chain order: no transaction is sent, so nothing reaches the log.
      const calls = tracked(describeListing('enable_sales', variables.collection, variables.item))
      return sellItem(
        { ...variables, address: session.address, chainId },
        { ...orderDeps(session, chainId, calls), onSigned }
      )
    },
    onSuccess: (listing, { collection }) => setListing(queryClient, collection, listing)
  })
}

function setListing(queryClient: ReturnType<typeof useQueryClient>, collection: Collection, listing: ItemListing) {
  queryClient.setQueryData<Map<string, ItemListing>>(['collection-listings', collection.contractAddress], current =>
    new Map(current ?? []).set(listing.itemId, listing)
  )
}

function removeListingFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  collection: Collection,
  itemId: string
) {
  queryClient.setQueryData<Map<string, ItemListing>>(['collection-listings', collection.contractAddress], current => {
    const next = new Map(current ?? [])
    next.delete(itemId)
    return next
  })
}

export type RemoveListingVariables = {
  collection: Collection
  item: Item
  listing: ItemListing
  /** The wallet prompt is over; the cancellation is mining. */
  onSigned?: () => void
}

/**
 * Takes the item off sale and waits until it is mined; the row drops its price right away. An off-chain
 * order gets its signature cancelled; a legacy CollectionStore price gets cleared on the collection.
 */
export function useRemoveListing(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  const tracked = useTrackedTransactionCalls(session)
  return useMutation({
    mutationFn: async ({ collection, item, listing, onSigned }: RemoveListingVariables): Promise<void> => {
      if (!session) throw new Error('Wallet disconnected')
      if (!collection.contractAddress) throw new SellItemError('not_published', 'The collection has no contract')
      const calls = tracked(describeListing('remove_listing', collection, item))
      const deps = { ...orderDeps(session, chainId, calls), onSigned }
      if (!listing.tradeId) return removeStoreListing(collection, item, chainId, { ...deps, readContract })
      return removeListing(
        { tradeId: listing.tradeId, contractAddress: collection.contractAddress, itemId: listing.itemId },
        deps
      )
    },
    onSuccess: (_, { collection, listing }) => removeListingFromCache(queryClient, collection, listing.itemId)
  })
}

export type UpdatePriceVariables = {
  collection: Collection
  item: Item
  tradeId: string
  credits: number
  onSigned?: (step: 'cancel' | 'sign') => void
  onCancelled?: (terms: ListingTerms) => void
}

/** Cancels the current order and signs a new one at the given price, keeping beneficiary and expiration. */
export function useUpdatePrice(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  const tracked = useTrackedTransactionCalls(session)
  return useMutation({
    mutationFn: async ({ onSigned, onCancelled, ...variables }: UpdatePriceVariables): Promise<ItemListing> => {
      if (!session) throw new Error('Wallet disconnected')
      // Only the cancellation of the old order is a transaction; the new price is an off-chain signature.
      const calls = tracked(describeListing('update_price', variables.collection, variables.item))
      return updatePrice(
        { ...variables, address: session.address, chainId },
        {
          ...orderDeps(session, chainId, calls),
          onSigned,
          onCancelled: terms => {
            // The old order is gone even if the new one never lands.
            removeListingFromCache(queryClient, variables.collection, variables.item.tokenId!)
            onCancelled?.(terms)
          }
        }
      )
    },
    onSuccess: (listing, { collection }) => setListing(queryClient, collection, listing)
  })
}

export type SendItemsVariables = {
  collection: Collection
  items: Item[]
  transfers: Transfer[]
  /** The wallet prompt is over; the transaction is mining. */
  onSigned?: () => void
}

/**
 * Mints the transfers straight to their recipients and waits until mined. builder-server reads
 * `total_supply` from the subgraph, which lags the transaction, so the items are patched in the cache
 * rather than refetched.
 */
export function useSendItems(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  const tracked = useTrackedTransactionCalls(session)
  return useMutation({
    mutationFn: async ({ collection, items, transfers, onSigned }: SendItemsVariables): Promise<void> => {
      if (!session) throw new Error('Wallet disconnected')
      const { beneficiaries, tokenIds } = flattenTransfers(transfers, items)
      const calls = tracked(describeSend(collection, items, transfers))
      const txHash = await calls.sendTransaction(buildIssueTokensCall(collection, beneficiaries, tokenIds, chainId))
      onSigned?.()
      const mined = await calls.waitForTransaction(txHash)
      if (!mined) throw new SellItemError('generic', 'The send items transaction reverted')
    },
    onSuccess: (_, { collection, transfers }) => {
      const copies = copiesPerItem(transfers)
      queryClient.setQueryData<Item[]>(['collection-items-all', session?.address, collection.id], current =>
        current?.map(item =>
          copies[item.id] ? { ...item, totalSupply: (item.totalSupply ?? 0) + copies[item.id] } : item
        )
      )
    }
  })
}

function describeListing(
  type: 'enable_sales' | 'remove_listing' | 'update_price',
  collection: Collection,
  item: Item
): ActivityEventInput {
  return { type, collectionId: collection.id, collectionName: collection.name, itemId: item.id, itemName: item.name }
}

// One item across every transfer reads "sent 3 copies of X"; several items read "sent 5 items".
function describeSend(collection: Collection, items: Item[], transfers: Transfer[]): ActivityEventInput {
  const sent = new Set(
    transfers.flatMap(transfer => Object.keys(transfer.amounts).filter(id => transfer.amounts[id] > 0))
  )
  const only = sent.size === 1 ? items.find(item => sent.has(item.id)) : undefined
  return {
    type: 'send_items',
    collectionId: collection.id,
    collectionName: collection.name,
    itemId: only?.id,
    itemName: only?.name,
    count: totalCopies(transfers)
  }
}

/** The creator's friends, loaded once the beneficiary picker needs them. */
export function useFriends(session: Session | null, enabled: boolean) {
  return useQuery({
    queryKey: ['friends', session?.address],
    queryFn: () => fetchFriends(session!.identity),
    enabled: !!session && enabled,
    staleTime: 5 * 60_000
  })
}
