import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { collectionCurationKey } from '~/hooks/useCuration'

const api = vi.hoisted(() => ({ pushCollectionCuration: vi.fn() }))
const monitoring = vi.hoisted(() => ({ captureError: vi.fn() }))
vi.mock('~/lib/builder', async importOriginal => ({ ...(await importOriginal<object>()), ...api }))
vi.mock('~/lib/monitoring', () => monitoring)
vi.mock('~/lib/analytics', () => ({ track: vi.fn(), errorCode: () => 'unknown' }))

const { BuilderServerError } = await import('~/lib/builder')
const { requestFirstReview } = await import('./usePublishCollection')

const address = '0xme'
const collection = { id: 'c1', urn: 'urn:decentraland:amoy:collections-v2:0xabc' } as Collection
const linked = { id: 'c2', urn: 'urn:decentraland:amoy:collections-thirdparty:brand' } as Collection
const pending = { collectionId: 'c1', status: 'pending', assignee: null } as CollectionCuration

let queryClient: QueryClient

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  queryClient.setQueryData(collectionCurationKey(address, collection.id), null)
})

describe('requestFirstReview', () => {
  it("opens the published collection's review request and shows it at once", async () => {
    api.pushCollectionCuration.mockResolvedValue(pending)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await requestFirstReview(queryClient, address, collection)

    expect(api.pushCollectionCuration).toHaveBeenCalledWith(address, collection.id)
    expect(queryClient.getQueryData(collectionCurationKey(address, collection.id))).toBe(pending)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['curations'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['curation-collections'] })
    expect(monitoring.captureError).not.toHaveBeenCalled()
  })

  it('is fine with a request that was already open, and rereads it', async () => {
    api.pushCollectionCuration.mockRejectedValue(
      new BuilderServerError('There is already an ongoing review request', 400)
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await requestFirstReview(queryClient, address, collection)

    expect(invalidate).toHaveBeenCalledWith({ queryKey: collectionCurationKey(address, collection.id) })
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
    expect(queryClient.getQueryData(collectionCurationKey(address, collection.id))).toBeNull()
  })

  it('leaves linked collections alone: their items are sent for review by their own flow', async () => {
    await requestFirstReview(queryClient, address, linked)
    expect(api.pushCollectionCuration).not.toHaveBeenCalled()
  })
})
