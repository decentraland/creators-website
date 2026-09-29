import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import {
  BuilderServerError,
  VALIDATION_RUNNING_STATUS,
  ValidationLimitError,
  appealCollectionCuration,
  fetchCollectionEvents,
  requestCollectionValidation
} from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { collectionCurationKey, collectionEventsKey } from '~/hooks/useCuration'
import { useFeatureFlag } from '~/hooks/useFeatureFlag'
import { getValidationAttemptsLeft, isValidationRunning, type CollectionEvent } from '~/lib/events'
import { FeatureFlag } from '~/lib/featureFlags'
import { captureError } from '~/lib/monitoring'

export { collectionEventsKey }

/**
 * Enough rows for the stage, the latest verdict and today's attempts in the first page. The server offsets
 * by `limit * (page - 1)`, so every page must ask for the same size or they overlap.
 */
export const EVENTS_PAGE_SIZE = 50

/** While the validator works, the page polls so the verdict shows without a reload. */
const RUNNING_POLL_MS = 10_000

type EventsPage = Awaited<ReturnType<typeof fetchCollectionEvents>> & { available: boolean }

/** A server without the timeline (404) is not an error: it reads as "no timeline", never as an empty one. */
async function fetchPage(address: string, collectionId: string, page: number, limit: number): Promise<EventsPage> {
  try {
    return { ...(await fetchCollectionEvents(address, collectionId, { page, limit })), available: true }
  } catch (error) {
    if (error instanceof BuilderServerError && error.status === 404) {
      return { results: [], total: 0, page, limit, available: false }
    }
    throw error
  }
}

/** Offset paging over a newest-first list repeats a row when an event lands between two pages. */
function dedupe(events: CollectionEvent[]): CollectionEvent[] {
  const seen = new Set<string>()
  return events.filter(event => (seen.has(event.id) ? false : (seen.add(event.id), true)))
}

/**
 * The collection's timeline, newest first, page by page, behind the auto-curation flag. `events` is `null`
 * until the timeline is known to exist (flag on, first page loaded, server serves it), so every consumer
 * falls back to the legacy curation state meanwhile. `pages[0]` doubles as the source of the review stage
 * and the validator's verdict.
 */
export function useCollectionEvents(address: string | undefined, collection: Collection | undefined, enabled = true) {
  const flag = useFeatureFlag(FeatureFlag.AUTO_CURATION)
  const queryClient = useQueryClient()
  const collectionId = collection?.id
  const query = useInfiniteQuery({
    queryKey: collectionEventsKey(address, collectionId),
    queryFn: ({ pageParam }) => fetchPage(address!, collectionId!, pageParam, EVENTS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.results.length, 0)
      return loaded < lastPage.total && lastPage.results.length > 0 ? pages.length + 1 : undefined
    },
    enabled: !!address && !!collection?.isPublished && enabled && flag.enabled,
    staleTime: 30_000,
    refetchInterval: current => {
      const first = current.state.data?.pages[0]?.results
      return first && isValidationRunning(first) ? RUNNING_POLL_MS : false
    }
  })
  const events = useMemo<CollectionEvent[] | null>(() => {
    const pages = query.data?.pages
    if (!pages?.length || !pages[0].available) return null
    return dedupe(pages.flatMap(page => page.results))
  }, [query.data])

  // A verdict that lands while polling also changed the request: refresh it so the stage and the pill agree.
  const latestId = events?.[0]?.id
  const seenLatest = useRef(latestId)
  useEffect(() => {
    if (seenLatest.current === latestId) return
    const wasLoaded = seenLatest.current !== undefined
    seenLatest.current = latestId
    if (wasLoaded) void queryClient.invalidateQueries({ queryKey: collectionCurationKey(address, collectionId) })
  }, [latestId, address, collectionId, queryClient])

  return { ...query, events, isAvailable: events !== null }
}

/** Enough of the newest events to tell the stage: assignments and submitted changes sit between the telling ones. */
const RECENT_EVENTS_LIMIT = 10

/** The newest few events, for list rows that need the stage and nothing else; `null` without a timeline. */
export function useRecentCollectionEvents(
  address: string | undefined,
  collectionId: string | undefined,
  enabled: boolean
) {
  const flag = useFeatureFlag(FeatureFlag.AUTO_CURATION)
  return useQuery({
    queryKey: [...collectionEventsKey(address, collectionId), 'recent'],
    queryFn: async (): Promise<CollectionEvent[] | null> => {
      const page = await fetchPage(address!, collectionId!, 1, RECENT_EVENTS_LIMIT)
      return page.available ? page.results : null
    },
    enabled: !!address && !!collectionId && enabled && flag.enabled,
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
