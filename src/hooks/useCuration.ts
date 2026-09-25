import { useMemo } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import {
  fetchCollectionCuration,
  fetchCommittee,
  fetchCurationCollections,
  fetchCurations,
  pushCollectionCuration,
  updateCollectionCuration
} from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { isCommitteeMember, type CollectionCuration, type CurationFilters } from '~/lib/curation'
import { captureError } from '~/lib/monitoring'

// Same refresh cadence as builder-server's own committee cache.
const COMMITTEE_STALE_MS = 60 * 60_000

/** Whether the signed-in wallet sits on the curation committee. Fails closed: loading or errored is not a curator. */
export function useCommittee(address: string | undefined) {
  const query = useQuery({ queryKey: ['committee'], queryFn: fetchCommittee, staleTime: COMMITTEE_STALE_MS })
  const members = query.data
  return {
    members: members ?? [],
    isCurator: isCommitteeMember(members, address),
    isLoading: query.isLoading
  }
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
    staleTime: 30_000
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
      track('Push curation', { collectionId: collection.id })
      store(curation)
    },
    onError: (error, collection) => {
      track('Push curation error', { collectionId: collection.id, error: errorCode(error) })
      captureError(error, { flow: 'curation_push', collectionId: collection.id })
    }
  })
}
