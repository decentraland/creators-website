import { useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import {
  BuilderServerError,
  COLLECTION_EVENTS_PAGE_SIZE,
  VALIDATION_RUNNING_STATUS,
  ValidationLimitError,
  appealCollectionCuration,
  fetchCollectionEvents,
  requestCollectionValidation
} from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { collectionCurationKey } from '~/hooks/useCuration'
import { getValidationAttemptsLeft, type CollectionEvent } from '~/lib/events'
import { captureError } from '~/lib/monitoring'

export function collectionEventsKey(address: string | undefined, collectionId: string | undefined) {
  return ['collection-events', address, collectionId] as const
}

/** Enough rows for the stage, the latest verdict and today's attempts in a single page; the timeline pages on. */
const FIRST_PAGE_SIZE = 50

/**
 * The collection's timeline, newest first, page by page. `pages[0]` doubles as the source of the review
 * stage and the validator's verdict; a 404 (server without the timeline yet) reads as an empty timeline.
 */
export function useCollectionEvents(address: string | undefined, collection: Collection | undefined, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: collectionEventsKey(address, collection?.id),
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchCollectionEvents(address!, collection!.id, {
          page: pageParam,
          limit: pageParam === 1 ? FIRST_PAGE_SIZE : COLLECTION_EVENTS_PAGE_SIZE
        })
      } catch (error) {
        if (error instanceof BuilderServerError && error.status === 404) {
          return { results: [], total: 0, page: pageParam, limit: FIRST_PAGE_SIZE }
        }
        throw error
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.results.length, 0)
      return loaded < lastPage.total && lastPage.results.length > 0 ? lastPage.page + 1 : undefined
    },
    enabled: !!address && !!collection?.isPublished && enabled,
    staleTime: 30_000
  })
  const events = useMemo<CollectionEvent[]>(() => query.data?.pages.flatMap(page => page.results) ?? [], [query.data])
  return { ...query, events }
}

/** Only the newest event, for list rows that need the stage and nothing else. Enabled per caller. */
export function useLatestCollectionEvent(
  address: string | undefined,
  collectionId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...collectionEventsKey(address, collectionId), 'latest'],
    queryFn: async () => {
      try {
        const page = await fetchCollectionEvents(address!, collectionId!, { page: 1, limit: 1 })
        return page.results[0] ?? null
      } catch (error) {
        if (error instanceof BuilderServerError && error.status === 404) return null
        throw error
      }
    },
    enabled: !!address && !!collectionId && enabled,
    staleTime: 30_000
  })
}

function useRefreshReview(address: string | undefined) {
  const queryClient = useQueryClient()
  return (collectionId: string) => {
    void queryClient.invalidateQueries({ queryKey: collectionEventsKey(address, collectionId) })
    void queryClient.invalidateQueries({ queryKey: collectionCurationKey(address, collectionId) })
    void queryClient.invalidateQueries({ queryKey: ['curations', address] })
  }
}

export type RequestValidationVariables = { collection: Collection; events: CollectionEvent[] }

/** The creator's "Validate again". 409 and 429 are answers the creator can act on, not failures to report. */
export function useRequestValidation(address: string | undefined) {
  const refresh = useRefreshReview(address)
  return useMutation({
    mutationFn: ({ collection }: RequestValidationVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      return requestCollectionValidation(address, collection.id)
    },
    onSuccess: (_, { collection, events }) => {
      track('Request validation', { collectionId: collection.id, attemptsLeft: getValidationAttemptsLeft(events) - 1 })
      refresh(collection.id)
    },
    onError: (error, { collection }) => {
      track('Request validation error', { collectionId: collection.id, error: errorCode(error) })
      const expected =
        error instanceof ValidationLimitError ||
        (error instanceof BuilderServerError && error.status === VALIDATION_RUNNING_STATUS)
      if (expected) refresh(collection.id)
      else captureError(error, { flow: 'curation_validate', collectionId: collection.id })
    }
  })
}

export type AppealVariables = { collection: Collection; note: string }

/** The creator's "Request human review": sends the rejection back to the committee with a note. */
export function useAppealCuration(address: string | undefined) {
  const refresh = useRefreshReview(address)
  return useMutation({
    mutationFn: ({ collection, note }: AppealVariables) => {
      if (!address) throw new Error('Wallet disconnected')
      return appealCollectionCuration(address, collection.id, note)
    },
    onSuccess: (_, { collection }) => {
      track('Appeal curation', { collectionId: collection.id })
      refresh(collection.id)
    },
    onError: (error, { collection }) => {
      track('Appeal curation error', { collectionId: collection.id, error: errorCode(error) })
      if (error instanceof BuilderServerError && error.status === VALIDATION_RUNNING_STATUS) refresh(collection.id)
      else captureError(error, { flow: 'curation_appeal', collectionId: collection.id })
    }
  })
}
