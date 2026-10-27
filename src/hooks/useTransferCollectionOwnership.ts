import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { sendContractTransaction, waitForTransaction, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { syncCollectionOwner } from '~/lib/builder'
import { buildTransferOwnershipCall, waitForOwnerSync } from '~/lib/collectionOwnership'
import { captureError } from '~/lib/monitoring'
import { getMaticChainId } from '~/lib/publishCollection'
import { SellItemError } from '~/lib/sales'

export type TransferOwnershipVariables = {
  collection: Collection
  newOwner: string
  /** The wallet prompt is over; the transaction is mining. */
  onSigned?: () => void
}

/** Hands the collection to another wallet in one transaction and waits until builder-server knows. */
export function useTransferCollectionOwnership(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationKey: ['transfer-collection-ownership'],
    mutationFn: async ({ collection, newOwner, onSigned }: TransferOwnershipVariables): Promise<Collection> => {
      if (!session) throw new Error('Wallet disconnected')
      const call = buildTransferOwnershipCall(collection, newOwner, chainId)
      const txHash = await sendContractTransaction(session, call)
      onSigned?.()
      const mined = await waitForTransaction(chainId, txHash)
      if (!mined) throw new SellItemError('generic', 'The transferCreatorship transaction reverted')
      const owner = newOwner.toLowerCase()
      track('Transfer collection ownership', { collectionId: collection.id, newOwner: owner })
      // The transfer is done at this point, whatever the server says: trying again would only revert.
      try {
        return await waitForOwnerSync(collection.id, newOwner, {
          syncCollectionOwner: id => syncCollectionOwner(session.address, id)
        })
      } catch (error) {
        captureError(error, { flow: 'transfer_ownership', collectionId: collection.id })
        return { ...collection, owner }
      }
    },
    onSuccess: collection => {
      if (!session) return
      queryClient.setQueryData(['collection', session.address, collection.id], collection)
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
    onError: (error, { collection }) =>
      track('Transfer collection ownership error', { collectionId: collection.id, error: errorCode(error) })
  })
}
