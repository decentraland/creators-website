import { useMemo } from 'react'
import { useTranslation } from '~/intl'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { sendContractTransaction, waitForTransaction, type Session } from '~/lib/auth'
import {
  fetchCollection,
  fetchCollectionCuration,
  fetchCommittee,
  fetchCurationCollections,
  fetchCurations,
  pushCollectionCuration,
  updateCollectionCuration
} from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { buildSetApprovedCall } from '~/lib/collectionApproval'
import { APPROVAL_INDEX_TIMEOUT_MS, waitForIndexer } from '~/lib/approveCollection'
import { isCommitteeMember, orderCurators, type CollectionCuration, type CurationFilters } from '~/lib/curation'
import { shortenAddress } from '~/lib/address'
import { captureError } from '~/lib/monitoring'
import { postAssignee } from '~/hooks/useForumPost'
import { useProfiles } from '~/hooks/useProfile'
import { getMaticChainId } from '~/lib/publishCollection'
import { isWalletRejection } from '~/lib/walletErrors'

// Same refresh cadence as builder-server's own committee cache.
const COMMITTEE_STALE_MS = 60 * 60_000

/** Whether the signed-in wallet sits on the curation committee. Fails closed: loading or errored is not a curator. */
const NO_MEMBERS: string[] = []

export function useCommittee(address: string | undefined) {
  // Signed-out visitors can't be curators, so they never ask.
  const query = useQuery({
    queryKey: ['committee'],
    queryFn: fetchCommittee,
    staleTime: COMMITTEE_STALE_MS,
    enabled: !!address
  })
  const members = query.data
  return {
    members: members ?? NO_MEMBERS,
    isCurator: isCommitteeMember(members, address),
    isLoading: query.isLoading
  }
}

/** The committee as picker options, the signed-in curator first and marked, after `leading` and a divider. */
type CuratorOption = { value: string; label: string; dividerBefore?: boolean }

export function useCuratorOptions(address: string | undefined, leading: CuratorOption) {
  const { t } = useTranslation()
  const { members } = useCommittee(address)
  const curators = useMemo(() => orderCurators(members, address), [members, address])
  const profiles = useProfiles(curators)
  const self = address?.toLowerCase()
  return useMemo<CuratorOption[]>(
    () => [
      leading,
      ...curators.map((curator, index) => {
        const name = profiles[index]?.name || shortenAddress(curator)
        return {
          value: curator,
          label: curator === self ? t('curation_page.filter.you', { name }) : name,
          dividerBefore: index === 0
        }
      })
    ],
    [leading, curators, profiles, self, t]
  )
}

export function collectionCurationKey(address: string | undefined, collectionId: string | undefined) {
  return ['collection-curation', address, collectionId] as const
}

/** The collection's latest review request, `null` when it was never requested. */
export function useCollectionCuration(address: string | undefined, collection: Collection | undefined) {
  return useQuery({
    queryKey: collectionCurationKey(address, collection?.id),
    queryFn: () => fetchCollectionCuration(address!, collection!.id),
    enabled: !!address && !!collection?.isPublished,
    staleTime: 30_000,
    retry: 1
  })
}

/** Every collection's latest review request, keyed by collection id; the list endpoint doesn't carry them. */
export function useCurationsByCollection(address: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ['curations', address],
    queryFn: () => fetchCurations(address!),
    enabled: !!address && enabled,
    staleTime: 30_000
  })
  const byCollection = useMemo(
    () => new Map((query.data ?? []).map(curation => [curation.collectionId, curation])),
    [query.data]
  )
  return { ...query, byCollection }
}

export function useCurationCollections(address: string | undefined, filters: CurationFilters, enabled: boolean) {
  return useQuery({
    queryKey: ['curation-collections', address, filters],
    queryFn: () => fetchCurationCollections(address!, filters),
    enabled: !!address && enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

function useStoreCuration(address: string | undefined) {
  const queryClient = useQueryClient()
  return (curation: CollectionCuration) => {
    queryClient.setQueryData(collectionCurationKey(address, curation.collectionId), curation)
    queryClient.setQueryData<CollectionCuration[]>(['curations', address], current =>
      current ? [...current.filter(existing => existing.collectionId !== curation.collectionId), curation] : current
    )
    void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
  }
}

export type AssignVariables = {
  collection: Collection
  curation: CollectionCuration | null
  assignee: string | null
}

/** Assigns, reassigns or unassigns the curator of a collection; a never-requested collection gets its first request. */
export function useAssignCurator(address: string | undefined) {
  const queryClient = useQueryClient()
  const store = useStoreCuration(address)
  return useMutation({
    mutationFn: ({ collection, curation, assignee }: AssignVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      return curation
        ? updateCollectionCuration(address, collection.id, { assignee })
        : pushCollectionCuration(address, collection.id, assignee)
    },
    onSuccess: (curation, { collection, assignee }) => {
      track(assignee ? 'Assign curator' : 'Unassign curator', { collectionId: collection.id, assignee })
      store(curation)
      if (address) void postAssignee(queryClient, address, collection, assignee)
    },
    onError: (error, { collection }) => {
      track('Assign curator error', { collectionId: collection.id, error: errorCode(error) })
      captureError(error, { flow: 'curation_assign', collectionId: collection.id })
    }
  })
}

export type RejectVariables = { collection: Collection; curation: CollectionCuration | null }

/**
 * Rejects the collection's review request. A collection nobody requested a review for has no request to
 * reject yet, so one is opened first: otherwise the rejection would leave no trace for the creator.
 */
export function useRejectCuration(address: string | undefined) {
  const queryClient = useQueryClient()
  const store = useStoreCuration(address)
  return useMutation({
    mutationFn: async ({ collection, curation }: RejectVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      const current = curation?.status === 'pending' ? curation : await pushCollectionCuration(address, collection.id)
      return updateCollectionCuration(address, current.collectionId, { status: 'rejected' })
    },
    onSuccess: (curation, { collection, curation: previous }) => {
      track('Reject curation', { collectionId: collection.id, first_review: !previous })
      store(curation)
    },
    onError: (error, { collection }) => {
      // The request may have been opened before the rejection failed; a retry must PATCH it, not POST again.
      void queryClient.invalidateQueries({ queryKey: collectionCurationKey(address, collection.id) })
      void queryClient.invalidateQueries({ queryKey: ['curations', address] })
      track('Reject curation error', { collectionId: collection.id, error: errorCode(error) })
      captureError(error, { flow: 'curation_reject', collectionId: collection.id })
    }
  })
}

/** The creator's "Publish updates": asks the committee to review the collection's changes again. */
export function usePushCuration(address: string | undefined) {
  const store = useStoreCuration(address)
  return useMutation({
    mutationFn: (collection: Collection) => {
      if (!address) throw new Error('Wallet disconnected')
      return pushCollectionCuration(address, collection.id)
    },
    onSuccess: (curation, collection) => {
      track('Push curation', { collectionId: collection.id, first_review: !collection.isApproved })
      store(curation)
    },
    onError: (error, collection) => {
      track('Push curation error', { collectionId: collection.id, error: errorCode(error) })
      captureError(error, { flow: 'curation_push', collectionId: collection.id })
    }
  })
}

/** Disables an approved collection on chain (not mintable anymore) and waits until it is mined. */
export type DisableVariables = { collection: Collection; onSigned?: () => void }

export function useDisableCollection(session: Session | null) {
  const queryClient = useQueryClient()
  const chainId = getMaticChainId()
  return useMutation({
    mutationFn: async ({ collection, onSigned }: DisableVariables) => {
      if (!session) throw new Error('Wallet disconnected')
      const txHash = await sendContractTransaction(session, buildSetApprovedCall(chainId, collection, false))
      onSigned?.()
      if (!(await waitForTransaction(chainId, txHash))) throw new Error(`Disable ${txHash} reverted`)
      // Like the approval, done means builder-server's lagging subgraph reads it too, so a refetch can't bring back
      // `is_approved: true`; past the timeout the cache carries the on-chain result.
      const indexed = await waitForIndexer(
        () => fetchCollection(session.address, collection.id),
        fetched => !fetched.isApproved,
        APPROVAL_INDEX_TIMEOUT_MS
      ).catch(() => ({ ...collection, isApproved: false }))
      return { txHash, indexed }
    },
    onSuccess: ({ txHash, indexed }, { collection }) => {
      // The legacy builder named the on-chain disable "Reject collection".
      track('Reject collection', { collectionId: collection.id, txHash })
      if (!session) return
      queryClient.setQueryData<Collection>(['collection', session.address, collection.id], indexed)
      void queryClient.invalidateQueries({ queryKey: ['curation-collections'] })
    },
    onError: (error, { collection }) => {
      track('Reject collection error', { collectionId: collection.id, error: errorCode(error) })
      if (!isWalletRejection(error)) {
        captureError(error, { flow: 'curation_disable', collectionId: collection.id })
      }
    }
  })
}
