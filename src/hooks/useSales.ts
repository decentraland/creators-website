import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sendContractTransaction, signTypedData, waitForTransaction, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { fetchFriends } from '~/lib/friends'
import { type Item } from '~/lib/items'
import { type ItemListing } from '~/lib/listings'
import { getMaticChainId } from '~/lib/publishCollection'
import {
  buildEnableSalesCall,
  isSalesEnabled,
  sellItem,
  SellItemError,
  withSalesEnabled,
  type SalePrice
} from '~/lib/sales'
import {
  OFFCHAIN_MARKETPLACE_TYPES,
  createTrade,
  fetchSignatureIndexes,
  getTradeDomain,
  toTradeTypedValues
} from '~/lib/trades'

// Collections whose sales this tab enabled: builder-server reports minters from the subgraph, which
// lags the transaction by a while, so a refetch in between must not bring the Enable Sales step back.
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

/** Signs the item's primary order and stores it; the collection's listings pick it up right away. */
export function useSellItem(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async ({ onSigned, ...variables }: SellItemVariables): Promise<ItemListing> => {
      if (!session) throw new Error('Wallet disconnected')
      const { address } = session
      return sellItem(
        { ...variables, address, chainId },
        {
          fetchSignatureIndexes,
          signTrade: trade =>
            signTypedData(session, getTradeDomain(chainId), OFFCHAIN_MARKETPLACE_TYPES, toTradeTypedValues(trade)),
          createTrade: trade => createTrade(address, trade),
          onSigned
        }
      )
    },
    onSuccess: (listing, { collection }) => {
      queryClient.setQueryData<Map<string, ItemListing>>(['collection-listings', collection.contractAddress], current =>
        new Map(current ?? []).set(listing.itemId, listing)
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
