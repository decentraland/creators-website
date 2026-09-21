import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ContractName, getContract } from 'decentraland-transactions'
import { errorCode, track } from '~/lib/analytics'
import {
  deleteItem,
  fetchAllCollectionItems,
  fetchContent,
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
import { authorizePublication } from '~/lib/credits'
import { withRehashedContents } from '~/lib/itemFactory'
import { type Item } from '~/lib/items'
import { buildManaApproveCall, fetchManaAllowance } from '~/lib/mana'
import { useNotifications } from '~/lib/notifications'
import {
  PublishTransactionRevertedError,
  consolidatePublishedCollection,
  getMaticChainId,
  publishCollection,
  syncPublishedItems,
  type PaymentMethod,
  type PublishResult
} from '~/lib/publishCollection'
import { type PublicationFee } from '~/lib/publishFee'
import { buildCollectionInitializeData } from '~/lib/saveCollection'
import { useTranslation } from '~/intl'

export function useRarities(address: string | undefined) {
  return useQuery({
    queryKey: ['rarities'],
    queryFn: () => fetchRarities(address),
    enabled: !!address,
    staleTime: 60_000
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

/** Approves the CollectionManager to spend exactly `amountWei` of MANA and waits until the approval is mined. */
export function useApproveMana(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async (amountWei: bigint) => {
      if (!session) throw new Error('Wallet disconnected')
      const spender = getContract(ContractName.CollectionManager, chainId).address
      const txHash = await sendContractTransaction(session, buildManaApproveCall(chainId, spender, amountWei))
      const mined = await waitForTransaction(chainId, txHash)
      if (!mined) throw new Error('MANA approval reverted')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mana-allowance', session?.address] })
    }
  })
}

export function invalidateCollectionItems(queryClient: ReturnType<typeof useQueryClient>, collectionId: string) {
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
      track('Delete item', { itemId: item.id })
      if (item.collectionId) invalidateCollectionItems(queryClient, item.collectionId)
    },
    onError: (error, item) => track('Delete item error', { itemId: item.id, error: errorCode(error) })
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
  const { t } = useTranslation()

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
          rehashItem: async item => {
            const built = await withRehashedContents(item, fetchContent)
            return saveItem(address, built.item, built.blobs)
          },
          saveTOS: (collection, email) => saveCollectionTOS(address, collection, email),
          authorizePublication: params => authorizePublication(address, params),
          sendTransaction: call => sendContractTransaction(session, call),
          lockCollection: collectionId => lockCollection(address, collectionId)
        }
      )
    },
    onSuccess: ({ collection, txHash }, { paymentMethod, fee }) => {
      // Legacy prop names (txHash, collectionId, usedCredits, creditsAmount) so the event lines up with
      // the same one from the old builder; `isFiat` is always false here — this app has no fiat publish.
      track('Publish collection', {
        collectionId: collection.id,
        txHash,
        isFiat: false,
        usedCredits: paymentMethod === 'credits',
        creditsAmount: paymentMethod === 'credits' ? fee.total.credits : 0,
        item_count: fee.itemCount
      })
      const address = session?.address
      queryClient.setQueryData(['collection', address, collection.id], collection)
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
      void queryClient.invalidateQueries({ queryKey: ['credits-balance', address] })
      void queryClient.invalidateQueries({ queryKey: ['mana-balance', address] })
      // Detached on purpose: the modal closes right away and the server catches up on its own.
      syncing.add(collection.id)
      consolidatePublishedCollection(collection.id, txHash, {
        waitForTransaction: hash => waitForTransaction(chainId, hash),
        publishCollectionItems: collectionId => publishCollectionItems(address!, collectionId)
      })
        .catch((error: unknown) => {
          console.error('Collection consolidation failed', error)
          // The modal is long gone: a lasting toast is the only way the creator learns the publish did not land.
          const key =
            error instanceof PublishTransactionRevertedError
              ? 'publish_collection_modal.consolidation.reverted'
              : 'publish_collection_modal.consolidation.sync_failed'
          useNotifications.getState().showToast(t(key, { name: collection.name }), {
            type: 'error',
            durationMs: CONSOLIDATION_TOAST_MS
          })
        })
        .finally(() => {
          syncing.delete(collection.id)
          invalidateCollectionItems(queryClient, collection.id)
        })
    },
    onError: (error, { collection, paymentMethod }) =>
      track('Publish collection error', {
        collectionId: collection.id,
        isFiat: false,
        usedCredits: paymentMethod === 'credits',
        error: errorCode(error)
      })
  })
}

const CONSOLIDATION_TOAST_MS = 20_000

// Collections whose chain→server sync is running in this tab, so a page mount doesn't start a second one.
const syncing = new Set<string>()

/**
 * Recovery for a publish whose consolidation never finished (tab closed before the transaction was
 * mined): once the server reports the collection published while its items still lack token ids,
 * asks builder-server to sync them — what the legacy builder did on every collection fetch.
 */
export function useSyncPublishedItems(address: string | undefined, collection: Collection | undefined, items: Item[]) {
  const queryClient = useQueryClient()
  const collectionId = collection?.id
  const isPublished = !!collection?.isPublished
  const needsSync = useMemo(() => isPublished && items.some(item => !item.tokenId), [isPublished, items])

  useEffect(() => {
    if (!address || !collectionId || !needsSync || syncing.has(collectionId)) return
    syncing.add(collectionId)
    syncPublishedItems(collectionId, { publishCollectionItems: id => publishCollectionItems(address, id) })
      .catch(error => console.error('Collection items sync failed', error))
      .finally(() => {
        syncing.delete(collectionId)
        invalidateCollectionItems(queryClient, collectionId)
      })
  }, [address, collectionId, needsSync, queryClient])
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
