import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ContractName, getContract } from 'decentraland-transactions'
import {
  deleteItem,
  fetchAllCollectionItems,
  fetchItemContents,
  fetchRarities,
  lockCollection,
  publishCollectionItems,
  saveCollection,
  saveCollectionTOS,
  saveItem
} from '~/lib/builder'
import { sendContractTransaction, waitForTransaction, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { authorizePublication, fetchCreditsBalance } from '~/lib/credits'
import { type Item } from '~/lib/items'
import { buildManaApproveCall, fetchManaAllowance, fetchManaBalance } from '~/lib/mana'
import {
  consolidatePublishedCollection,
  getMaticChainId,
  publishCollection,
  type PaymentMethod,
  type PublishResult
} from '~/lib/publishCollection'
import { type PublicationFee } from '~/lib/publishFee'
import { buildCollectionInitializeData } from '~/lib/saveCollection'

export function useRarities(address: string | undefined) {
  return useQuery({
    queryKey: ['rarities'],
    queryFn: () => fetchRarities(address),
    enabled: !!address,
    staleTime: 60_000
  })
}

export function useCreditsBalance(address: string | undefined) {
  return useQuery({
    queryKey: ['credits-balance', address],
    queryFn: () => fetchCreditsBalance(address!),
    enabled: !!address,
    staleTime: 30_000
  })
}

export function useManaBalance(address: string | undefined) {
  const chainId = getMaticChainId()
  return useQuery({
    queryKey: ['mana-balance', address, chainId],
    queryFn: () => fetchManaBalance(address!, chainId),
    enabled: !!address,
    staleTime: 30_000
  })
}

/** How much MANA the CollectionManager may pull from the wallet — the publish fee must fit in it. */
export function useManaAllowance(address: string | undefined, enabled = true) {
  const chainId = getMaticChainId()
  const spender = getContract(ContractName.CollectionManager, chainId).address
  return useQuery({
    queryKey: ['mana-allowance', address, chainId, spender],
    queryFn: () => fetchManaAllowance(address!, spender, chainId),
    enabled: !!address && enabled,
    staleTime: 30_000
  })
}

/** Approves the CollectionManager to spend MANA and waits until the approval is mined. */
export function useApproveMana(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Wallet disconnected')
      const spender = getContract(ContractName.CollectionManager, chainId).address
      const txHash = await sendContractTransaction(session, buildManaApproveCall(chainId, spender))
      const mined = await waitForTransaction(chainId, txHash)
      if (!mined) throw new Error('MANA approval reverted')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mana-allowance', session?.address] })
    }
  })
}

function invalidateCollectionItems(queryClient: ReturnType<typeof useQueryClient>, collectionId: string) {
  void queryClient.invalidateQueries({
    queryKey: ['collection-items'],
    predicate: q => q.queryKey.includes(collectionId)
  })
  void queryClient.invalidateQueries({
    queryKey: ['collection-items-all'],
    predicate: q => q.queryKey.includes(collectionId)
  })
  void queryClient.invalidateQueries({ queryKey: ['collection'], predicate: q => q.queryKey.includes(collectionId) })
  void queryClient.invalidateQueries({
    queryKey: ['collection-preview'],
    predicate: q => q.queryKey.includes(collectionId)
  })
}

export function useDeleteItem(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: Item) => {
      if (!address) throw new Error('Wallet disconnected')
      await deleteItem(address, item.id)
      return item
    },
    onSuccess: item => {
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    }
  })
}

/** Saves item fields (name, rarity, ...), uploading any files passed in `blobs`. */
export function useUpdateItem(address: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, blobs = {} }: { item: Item; blobs?: Record<string, Blob> }) => {
      if (!address) throw new Error('Wallet disconnected')
      return saveItem(address, item, blobs)
    },
    onSuccess: item => {
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    }
  })
}

export type PublishVariables = {
  collection: Collection
  items: Item[]
  paymentMethod: PaymentMethod
  fee: PublicationFee
  email: string | null
}

/**
 * Runs the publish sequence for the connected wallet. On success the collection is locked in the
 * cache and the chain→server consolidation continues in the background; the caller's UI is done.
 */
export function usePublishCollection(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()

  return useMutation({
    mutationFn: async (variables: PublishVariables): Promise<PublishResult> => {
      if (!session) throw new Error('Wallet disconnected')
      const { address } = session
      return publishCollection(
        { ...variables, address, chainId },
        {
          saveCollection: (collection, items) =>
            saveCollection(address, collection, buildCollectionInitializeData(collection, items, address)),
          fetchItems: collectionId => fetchAllCollectionItems(address, collectionId),
          saveTOS: (collection, email) => saveCollectionTOS(address, collection, email),
          authorizePublication: params => authorizePublication(address, params),
          sendTransaction: call => sendContractTransaction(session, call),
          lockCollection: collectionId => lockCollection(address, collectionId)
        }
      )
    },
    onSuccess: ({ collection, txHash }) => {
      const address = session?.address
      queryClient.setQueryData(['collection', address, collection.id], collection)
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
      void queryClient.invalidateQueries({ queryKey: ['credits-balance', address] })
      void queryClient.invalidateQueries({ queryKey: ['mana-balance', address] })
      // Detached on purpose: the modal closes right away and the server catches up on its own.
      consolidatePublishedCollection(collection.id, txHash, {
        waitForTransaction: hash => waitForTransaction(chainId, hash),
        publishCollectionItems: collectionId => publishCollectionItems(address!, collectionId)
      })
        .catch(error => console.error('Collection consolidation failed', error))
        .finally(() => invalidateCollectionItems(queryClient, collection.id))
    }
  })
}

/** The files of a saved item as blobs, for the thumbnail editor; off until an item is given. */
export function useItemContents(item: Item | null) {
  return useQuery({
    queryKey: ['item-contents', item?.id, item?.updatedAt],
    queryFn: () => fetchItemContents(item!),
    enabled: item !== null,
    staleTime: Infinity
  })
}
