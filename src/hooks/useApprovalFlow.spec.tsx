import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { type Item } from '~/lib/items'

const flow = vi.hoisted(() => ({
  ensureTokenIds: vi.fn(),
  findItemsToRescue: vi.fn(),
  rescueItems: vi.fn(),
  findItemsToDeploy: vi.fn(),
  deployItems: vi.fn(),
  approveOnChain: vi.fn(),
  buildMissingImage: vi.fn()
}))
const api = vi.hoisted(() => ({
  fetchAllCollectionItems: vi.fn(),
  publishCollectionItems: vi.fn(),
  updateCollectionCuration: vi.fn(),
  fetchContent: vi.fn()
}))
vi.mock('~/lib/approveCollection', () => flow)
vi.mock('~/lib/builder', () => api)
vi.mock('~/lib/catalyst', () => ({
  fetchEntitiesByPointers: vi.fn().mockResolvedValue([]),
  fetchAvailableContent: vi.fn(),
  deployEntity: vi.fn()
}))
vi.mock('~/lib/auth', () => ({
  sendContractTransaction: vi.fn(),
  signWithIdentity: vi.fn(),
  waitForTransaction: vi.fn()
}))
vi.mock('~/lib/analytics', () => ({ track: vi.fn(), errorCode: () => 'unknown' }))
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))
vi.mock('~/lib/media', () => ({ generateCatalystImage: vi.fn() }))

const { useApprovalFlow } = await import('./useApprovalFlow')

const session = { address: '0xme' } as Session
const item = { id: 'i1', urn: 'urn:1' } as Item
const collection = { id: 'c1', isApproved: false } as Collection
const pending = { status: 'pending' } as CollectionCuration

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

beforeEach(() => {
  Object.values(flow).forEach(fn => fn.mockReset())
  Object.values(api).forEach(fn => fn.mockReset())
  api.fetchAllCollectionItems.mockResolvedValue([item])
  flow.ensureTokenIds.mockImplementation(async (items: Item[]) => items)
  flow.findItemsToRescue.mockResolvedValue([])
  flow.findItemsToDeploy.mockReturnValue([])
  flow.rescueItems.mockResolvedValue([item])
  flow.deployItems.mockResolvedValue({ deployed: [item], failed: [] })
  flow.approveOnChain.mockResolvedValue('0xtx')
})

describe('useApprovalFlow', () => {
  it('walks a first review through rescue, deploy and the on-chain approval, closing the pending request', async () => {
    flow.findItemsToRescue.mockResolvedValue([{ item, contentHash: 'h' }])
    flow.findItemsToDeploy.mockReturnValue([item])
    const { result } = renderHook(() => useApprovalFlow(session, collection, pending, 'approve'), { wrapper })

    await act(() => result.current.start())
    expect(result.current.view).toMatchObject({ kind: 'rescue', count: 1 })
    await act(() => result.current.runRescue())
    expect(result.current.view).toMatchObject({ kind: 'deploy', count: 1 })
    await act(() => result.current.runDeploy())
    expect(result.current.view).toMatchObject({ kind: 'approve' })
    await act(() => result.current.runApprove())
    expect(result.current.view).toEqual({ kind: 'success' })
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('approves pushed changes of an approved collection without a transaction', async () => {
    const { result } = renderHook(
      () => useApprovalFlow(session, { ...collection, isApproved: true }, pending, 'approve'),
      {
        wrapper
      }
    )
    await act(() => result.current.start())
    expect(result.current.view).toEqual({ kind: 'success' })
    expect(flow.approveOnChain).not.toHaveBeenCalled()
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('keeps the failed uploads for a retry', async () => {
    flow.findItemsToDeploy.mockReturnValue([item])
    flow.deployItems.mockResolvedValueOnce({ deployed: [], failed: [item] })
    const { result } = renderHook(() => useApprovalFlow(session, collection, null, 'deploy_missing'), { wrapper })
    await act(() => result.current.start())
    await act(() => result.current.runDeploy())
    expect(result.current.view).toMatchObject({ kind: 'deploy', failed: 1, busy: false })
    await act(() => result.current.runDeploy())
    expect(result.current.view).toEqual({ kind: 'success' })
    expect(flow.findItemsToRescue).not.toHaveBeenCalled()
  })

  it('shows the failed step', async () => {
    flow.findItemsToRescue.mockResolvedValue([{ item, contentHash: 'h' }])
    flow.rescueItems.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useApprovalFlow(session, collection, null, 'approve'), { wrapper })
    await act(() => result.current.start())
    await act(() => result.current.runRescue())
    expect(result.current.view).toEqual({ kind: 'error', step: 'rescue' })
  })
})
