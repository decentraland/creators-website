import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'

const api = vi.hoisted(() => ({
  fetchCommittee: vi.fn(),
  pushCollectionCuration: vi.fn(),
  updateCollectionCuration: vi.fn()
}))
vi.mock('~/lib/builder', () => ({
  ...api,
  fetchCollectionCuration: vi.fn(),
  fetchCurationCollections: vi.fn(),
  fetchCurations: vi.fn()
}))
vi.mock('~/lib/analytics', () => ({ track: vi.fn(), errorCode: () => 'unknown' }))
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))

const { useAssignCurator, useCommittee, useRejectCuration } = await import('./useCuration')

const ADDRESS = '0xCurator'
const collection = { id: 'c1', name: 'Hats', isPublished: true } as Collection
const pending: CollectionCuration = {
  id: 'r1',
  collectionId: 'c1',
  status: 'pending',
  assignee: null,
  createdAt: 1,
  updatedAt: 1
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.pushCollectionCuration.mockResolvedValue(pending)
  api.updateCollectionCuration.mockImplementation((_a: string, _c: string, change: object) =>
    Promise.resolve({ ...pending, ...change })
  )
})

describe('useCommittee', () => {
  it('is not a curator until the committee loads, then matches the wallet case-insensitively', async () => {
    api.fetchCommittee.mockResolvedValue(['0xcurator'])
    const { result } = renderHook(() => useCommittee(ADDRESS), { wrapper })
    expect(result.current.isCurator).toBe(false)
    await waitFor(() => expect(result.current.isCurator).toBe(true))
  })

  it('fails closed when the committee cannot be read', async () => {
    api.fetchCommittee.mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useCommittee(ADDRESS), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isCurator).toBe(false)
  })
})

describe('useRejectCuration', () => {
  it('rejects the pending request', async () => {
    const { result } = renderHook(() => useRejectCuration(ADDRESS), { wrapper })
    await act(() => result.current.mutateAsync({ collection, curation: pending }))
    expect(api.pushCollectionCuration).not.toHaveBeenCalled()
    expect(api.updateCollectionCuration).toHaveBeenCalledWith(ADDRESS, 'c1', { status: 'rejected' })
  })

  it('opens a request first when nobody asked for a review, so the rejection reaches the creator', async () => {
    const { result } = renderHook(() => useRejectCuration(ADDRESS), { wrapper })
    const rejected = await act(() => result.current.mutateAsync({ collection, curation: null }))
    expect(api.pushCollectionCuration).toHaveBeenCalledWith(ADDRESS, 'c1')
    expect(rejected.status).toBe('rejected')
  })
})

describe('useAssignCurator', () => {
  it('assigns through the existing request, or opens one for a never-requested collection', async () => {
    const { result } = renderHook(() => useAssignCurator(ADDRESS), { wrapper })
    await act(() => result.current.mutateAsync({ collection, curation: pending, assignee: '0xcurator' }))
    expect(api.updateCollectionCuration).toHaveBeenCalledWith(ADDRESS, 'c1', { assignee: '0xcurator' })

    await act(() => result.current.mutateAsync({ collection, curation: null, assignee: '0xcurator' }))
    expect(api.pushCollectionCuration).toHaveBeenCalledWith(ADDRESS, 'c1', '0xcurator')
  })
})
