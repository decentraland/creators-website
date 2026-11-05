import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type Item } from '~/lib/items'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { collectionCurationKey } from '~/hooks/useCuration'

const api = vi.hoisted(() => ({
  fetchCollectionCuration: vi.fn(),
  pushCollectionCuration: vi.fn(),
  publishCollectionItems: vi.fn()
}))
const monitoring = vi.hoisted(() => ({ captureError: vi.fn() }))
vi.mock('~/lib/builder', async importOriginal => ({ ...(await importOriginal<object>()), ...api }))
vi.mock('~/lib/monitoring', () => monitoring)

const { BuilderServerError } = await import('~/lib/builder')
const { requestFirstReview, useSyncPublishedItems } = await import('./usePublishCollection')

const address = '0xme'
const collection = { id: 'c1', urn: 'urn:decentraland:amoy:collections-v2:0xabc' } as Collection
const linked = { id: 'c2', urn: 'urn:decentraland:amoy:collections-thirdparty:brand' } as Collection
const pending = { collectionId: 'c1', status: 'pending', assignee: null } as CollectionCuration
const other = { collectionId: 'c9', status: 'approved', assignee: null } as CollectionCuration

let queryClient: QueryClient

const shownCuration = () => queryClient.getQueryData(collectionCurationKey(address, collection.id))
const listedCurations = () => queryClient.getQueryData<CollectionCuration[]>(['curations', address])

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  queryClient.setQueryData(collectionCurationKey(address, collection.id), null)
  queryClient.setQueryData(['curations', address], [other])
  api.fetchCollectionCuration.mockResolvedValue(null)
})

describe('requestFirstReview', () => {
  it("opens the published collection's review request and shows it at once on the page and in the list", async () => {
    api.pushCollectionCuration.mockResolvedValue(pending)

    await requestFirstReview(queryClient, address, collection)

    expect(shownCuration()).toBe(pending)
    expect(listedCurations()).toEqual([other, pending])
    expect(monitoring.captureError).not.toHaveBeenCalled()
  })

  it('shows the request that already exists instead of opening another', async () => {
    const rejected = { ...pending, status: 'rejected' } as CollectionCuration
    api.fetchCollectionCuration.mockResolvedValue(rejected)

    await requestFirstReview(queryClient, address, collection)

    expect(api.pushCollectionCuration).not.toHaveBeenCalled()
    expect(shownCuration()).toBe(rejected)
  })

  it('shows the request another tab opened in the meantime, without reporting it', async () => {
    api.fetchCollectionCuration.mockResolvedValueOnce(null).mockResolvedValueOnce(pending)
    api.pushCollectionCuration.mockRejectedValue(
      new BuilderServerError('There is already an ongoing review request', 400)
    )

    await requestFirstReview(queryClient, address, collection)

    expect(shownCuration()).toBe(pending)
    expect(monitoring.captureError).not.toHaveBeenCalled()
  })

  it('reports any other failure without failing the publish', async () => {
    const error = new BuilderServerError('Service unavailable', 503)
    api.pushCollectionCuration.mockRejectedValue(error)

    await expect(requestFirstReview(queryClient, address, collection)).resolves.toBeUndefined()

    expect(monitoring.captureError).toHaveBeenCalledWith(error, {
      flow: 'publish_review_request',
      collectionId: collection.id
    })
    expect(shownCuration()).toBeNull()
  })

  it('leaves linked collections alone: their items are sent for review by their own flow', async () => {
    await requestFirstReview(queryClient, address, linked)

    expect(api.fetchCollectionCuration).not.toHaveBeenCalled()
    expect(api.pushCollectionCuration).not.toHaveBeenCalled()
  })
})

describe('useSyncPublishedItems', () => {
  const published = { ...collection, isPublished: true } as Collection
  const unsyncedItem = { id: 'i1', tokenId: undefined } as unknown as Item

  it('opens the review request once it finishes a publish the tab left halfway', async () => {
    api.publishCollectionItems.mockResolvedValue({})
    api.pushCollectionCuration.mockResolvedValue(pending)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(() => useSyncPublishedItems(address, published, [unsyncedItem]), { wrapper })

    await waitFor(() => expect(shownCuration()).toBe(pending))
  })
})
