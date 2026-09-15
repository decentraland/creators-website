import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendContractTransaction, waitForTransaction, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { buildSetRolesCall, diffRoles, getRoleAddresses, withRoles, type RoleKind } from '~/lib/collectionRoles'
import { getMaticChainId } from '~/lib/publishCollection'
import { SellItemError } from '~/lib/sales'

// Role lists this tab saved: builder-server reports minters and managers from the subgraph, which lags the
// transaction by a while, so a refetch in between must not bring the old list back.
const savedInSession = new Map<string, string[]>()
const sessionKey = (collection: Collection, kind: RoleKind) => `${collection.id}:${kind}`

/** The senders or collaborators to show: what this tab last saved, else what builder-server reports. */
export function useRoleAddresses(collection: Collection, kind: RoleKind): string[] {
  return savedInSession.get(sessionKey(collection, kind)) ?? getRoleAddresses(collection, kind, getMaticChainId())
}

export type SetRolesVariables = {
  collection: Collection
  kind: RoleKind
  current: string[]
  next: string[]
  /** The wallet prompt is over; the transaction is mining. */
  onSigned?: () => void
}

/** Grants and revokes a role in one transaction and waits until it is mined. */
export function useSetCollectionRoles(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async ({ collection, kind, current, next, onSigned }: SetRolesVariables): Promise<Collection> => {
      if (!session) throw new Error('Wallet disconnected')
      const call = buildSetRolesCall(collection, kind, diffRoles(current, next), chainId)
      const txHash = await sendContractTransaction(session, call)
      onSigned?.()
      const mined = await waitForTransaction(chainId, txHash)
      if (!mined) throw new SellItemError('generic', `The ${call.method} transaction reverted`)
      return withRoles(collection, kind, next, chainId)
    },
    onSuccess: (collection, { kind, next }) => {
      savedInSession.set(sessionKey(collection, kind), next)
      queryClient.setQueryData(['collection', session?.address, collection.id], collection)
    }
  })
}
