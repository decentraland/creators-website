import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type TradeCreation } from '@dcl/schemas'
import {
  readContract,
  sendContractTransaction,
  signTypedData,
  waitForTransaction,
  type ContractCall,
  type Session
} from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { fetchFriends } from '~/lib/friends'
import { type Item } from '~/lib/items'
import { fetchItemTradeId, type ItemListing } from '~/lib/listings'
import { buildIssueTokensCall, copiesPerItem, flattenTransfers, type Transfer } from '~/lib/mint'
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
  return useMutation({
    mutationFn: async ({ collection, onSigned }: EnableSalesVariables): Promise<Collection> => {
      if (!session) throw new Error('Wallet disconnected')
      const txHash = await sendContractTransaction(session, buildEnableSalesCall(collection, chainId))
      onSigned?.()
      const mined = await waitForTransaction(chainId, txHash)
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

// The wallet-facing half of signing and storing an order, shared by selling and re-pricing.
function orderDeps(session: Session, chainId: number) {
  return {
    fetchTrade,
    fetchItemTradeId,
    fetchSignatureIndexes,
    sendTransaction: (call: ContractCall) => sendContractTransaction(session, call),
    waitForTransaction: (hash: string) => waitForTransaction(chainId, hash),
    signTrade: (trade: UnsignedTrade) =>
      signTypedData(session, getTradeDomain(chainId), OFFCHAIN_MARKETPLACE_TYPES, toTradeTypedValues(trade)),
    createTrade: (trade: TradeCreation) => createTrade(session.address, trade)
  }
}

/** Signs the item's primary order and stores it; the collection's listings pick it up right away. */
export function useSellItem(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async ({ onSigned, ...variables }: SellItemVariables): Promise<ItemListing> => {
      if (!session) throw new Error('Wallet disconnected')
      return sellItem({ ...variables, address: session.address, chainId }, { ...orderDeps(session, chainId), onSigned })
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
  return useMutation({
    mutationFn: async ({ collection, item, listing, onSigned }: RemoveListingVariables): Promise<void> => {
      if (!session) throw new Error('Wallet disconnected')
      if (!collection.contractAddress) throw new SellItemError('not_published', 'The collection has no contract')
      const deps = { ...orderDeps(session, chainId), onSigned }
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
  return useMutation({
    mutationFn: async ({ onSigned, onCancelled, ...variables }: UpdatePriceVariables): Promise<ItemListing> => {
      if (!session) throw new Error('Wallet disconnected')
      return updatePrice(
        { ...variables, address: session.address, chainId },
        {
          ...orderDeps(session, chainId),
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
  return useMutation({
    mutationFn: async ({ collection, items, transfers, onSigned }: SendItemsVariables): Promise<void> => {
      if (!session) throw new Error('Wallet disconnected')
      const { beneficiaries, tokenIds } = flattenTransfers(transfers, items)
      const txHash = await sendContractTransaction(
        session,
        buildIssueTokensCall(collection, beneficiaries, tokenIds, chainId)
      )
      onSigned?.()
      const mined = await waitForTransaction(chainId, txHash)
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

/** The creator's friends, loaded once the beneficiary picker needs them. */
export function useFriends(session: Session | null, enabled: boolean) {
  return useQuery({
    queryKey: ['friends', session?.address],
    queryFn: () => fetchFriends(session!.identity),
    enabled: !!session && enabled,
    staleTime: 5 * 60_000
  })
}
