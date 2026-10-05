import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type ContractCall, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { type Item } from '~/lib/items'

const flow = vi.hoisted(() => ({
  APPROVAL_INDEX_TIMEOUT_MS: 1000,
  ensureTokenIds: vi.fn(),
  findItemsToRescue: vi.fn(),
  rescueItems: vi.fn(),
  findItemsToDeploy: vi.fn(),
  deployItems: vi.fn(),
  approveOnChain: vi.fn(),
  buildMissingImage: vi.fn(),
  waitForIndexer: vi.fn()
}))
const api = vi.hoisted(() => ({
  fetchAllCollectionItems: vi.fn(),
  fetchCollection: vi.fn(),
  publishCollectionItems: vi.fn(),
  updateCollectionCuration: vi.fn(),
  pushCollectionCuration: vi.fn(),
  fetchContent: vi.fn()
}))
const auth = vi.hoisted(() => ({
  sendContractTransaction: vi.fn(),
  signWithIdentity: vi.fn(),
  waitForTransaction: vi.fn()
}))
vi.mock('~/lib/approveCollection', () => flow)
vi.mock('~/lib/builder', () => api)
vi.mock('~/lib/auth', () => auth)
vi.mock('~/lib/catalyst', () => ({
  fetchEntitiesByPointers: vi.fn().mockResolvedValue([]),
  fetchAvailableContent: vi.fn(),
  deployEntity: vi.fn()
}))
vi.mock('~/lib/analytics', () => ({ track: vi.fn(), errorCode: () => 'unknown' }))
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))
vi.mock('~/lib/media', () => ({ generateCatalystImage: vi.fn() }))

const { useApprovalFlow } = await import('./useApprovalFlow')
type ApprovalMode = import('./useApprovalFlow').ApprovalMode

type Deps = { sendTransaction: (call: ContractCall) => Promise<string> }

const session = { address: '0xme' } as Session
const item = { id: 'i1', name: 'Hat', urn: 'urn:1' } as Item
const collection = { id: 'c1', isApproved: false } as Collection
const pending = { collectionId: 'c1', status: 'pending' } as CollectionCuration

let queryClient: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function renderFlow(
  subject = collection,
  curation: CollectionCuration | null = pending,
  mode: ApprovalMode = 'approve'
) {
  return renderHook(() => useApprovalFlow(session, subject, curation, mode), { wrapper })
}

beforeEach(() => {
  queryClient = new QueryClient()
  Object.values(flow).forEach(fn => typeof fn === 'function' && fn.mockReset())
  Object.values(api).forEach(fn => fn.mockReset())
  Object.values(auth).forEach(fn => fn.mockReset())
  api.fetchAllCollectionItems.mockResolvedValue([item])
  api.fetchCollection.mockResolvedValue({ ...collection, isApproved: true })
  flow.ensureTokenIds.mockImplementation(async (items: Item[]) => items)
  flow.findItemsToRescue.mockResolvedValue([])
  flow.findItemsToDeploy.mockReturnValue([])
  flow.rescueItems.mockResolvedValue([item])
  flow.deployItems.mockResolvedValue({ deployed: [item], failed: [] })
  flow.approveOnChain.mockImplementation((_collection: Collection, deps: Deps) =>
    deps.sendTransaction({} as ContractCall)
  )
  flow.waitForIndexer.mockImplementation(async (read: () => Promise<unknown>, isDone: (value: unknown) => boolean) => {
    for (;;) {
      const value = await read()
      if (isDone(value)) return value
    }
  })
  auth.sendContractTransaction.mockResolvedValue('0xtx')
})

describe('useApprovalFlow', () => {
  it('walks a first review through each step it needs, closing the pending request at the end', async () => {
    flow.findItemsToRescue.mockResolvedValue([{ item, contentHash: 'h' }])
    flow.findItemsToDeploy.mockReturnValue([item])
    const { result } = renderFlow()

    await act(() => result.current.start())
    expect(result.current.plan.steps).toEqual(['rescue', 'deploy', 'approve'])
    expect(result.current.view).toMatchObject({ kind: 'step', step: 'rescue', phase: { kind: 'idle' } })
    await act(() => result.current.runRescue())
    expect(result.current.view).toMatchObject({ kind: 'step', step: 'deploy' })
    await act(() => result.current.runDeploy())
    expect(result.current.view).toMatchObject({ kind: 'step', step: 'approve' })
    await act(() => result.current.runApprove())
    expect(result.current.view).toEqual({ kind: 'success' })
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('skips the steps with nothing to do', async () => {
    const { result } = renderFlow()
    await act(() => result.current.start())
    expect(result.current.plan.steps).toEqual(['approve'])
  })

  it('shows success only once builder-server reads the collection as approved', async () => {
    api.fetchCollection
      .mockResolvedValueOnce({ ...collection, isApproved: false })
      .mockResolvedValueOnce({ ...collection, isApproved: true, name: 'From server' })
    const { result } = renderFlow()
    await act(() => result.current.start())
    await act(() => result.current.runApprove())
    expect(api.fetchCollection).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData<Collection>(['collection', '0xme', 'c1'])).toMatchObject({ name: 'From server' })
    expect(result.current.view).toEqual({ kind: 'success' })
  })

  it('still succeeds when builder-server takes too long, keeping the on-chain result', async () => {
    flow.waitForIndexer.mockRejectedValue(new Error('not indexed'))
    const { result } = renderFlow()
    await act(() => result.current.start())
    await act(() => result.current.runApprove())
    expect(queryClient.getQueryData<Collection>(['collection', '0xme', 'c1'])).toMatchObject({ isApproved: true })
    expect(result.current.view).toEqual({ kind: 'success' })
  })

  it('approves a rejected first review through a new request in the approver’s name, so it stops reading as rejected', async () => {
    const { result } = renderFlow(collection, { status: 'rejected' } as CollectionCuration)
    await act(() => result.current.start())
    await act(() => result.current.runApprove())
    expect(api.pushCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', '0xme')
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('closes the request opened after the flow started, e.g. by assigning the collection', async () => {
    queryClient.setQueryData(['collection-curation', '0xme', 'c1'], pending)
    const { result } = renderFlow(collection, null)
    await act(() => result.current.start())
    await act(() => result.current.runApprove())
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('closes the request once the approval landed on chain, even if the flow unmounted meanwhile', async () => {
    let land: (txHash: string) => void = () => undefined
    auth.sendContractTransaction.mockReturnValue(new Promise<string>(resolve => (land = resolve)))
    const { result } = renderFlow()
    await act(() => result.current.start())
    let approving: Promise<void> = Promise.resolve()
    act(() => {
      approving = result.current.runApprove()
    })
    result.current.stop()
    await act(async () => {
      land('0xtx')
      await approving
    })
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('does not close the request when the curator closed the flow while it was loading', async () => {
    let release: (items: Item[]) => void = () => undefined
    api.fetchAllCollectionItems.mockReturnValue(new Promise<Item[]>(resolve => (release = resolve)))
    const { result } = renderFlow({ ...collection, isApproved: true })
    let running: Promise<void> = Promise.resolve()
    act(() => {
      running = result.current.start()
    })
    result.current.stop()
    await act(async () => {
      release([item])
      await running
    })
    expect(api.updateCollectionCuration).not.toHaveBeenCalled()
  })

  it('approves pushed changes of an approved collection without a transaction', async () => {
    const { result } = renderFlow({ ...collection, isApproved: true })
    await act(() => result.current.start())
    expect(result.current.view).toEqual({ kind: 'success' })
    expect(flow.approveOnChain).not.toHaveBeenCalled()
    expect(api.updateCollectionCuration).toHaveBeenCalledWith('0xme', 'c1', { status: 'approved' })
  })

  it('reports each failed upload with its reason, and a retry starts over from what is still missing', async () => {
    flow.findItemsToDeploy.mockReturnValue([item])
    flow.deployItems.mockResolvedValueOnce({ deployed: [], failed: [{ item, message: 'Catalyst said no' }] })
    const { result } = renderFlow({ ...collection, isApproved: true }, null, 'deploy_missing')
    await act(() => result.current.start())
    await act(() => result.current.runDeploy())
    expect(result.current.view).toMatchObject({
      kind: 'error',
      step: 'deploy',
      failed: [{ item, message: 'Catalyst said no' }]
    })

    await act(() => result.current.start())
    await act(() => result.current.runDeploy())
    expect(result.current.view).toEqual({ kind: 'success' })
    expect(flow.findItemsToRescue).not.toHaveBeenCalled()
  })

  it('shows the failed step with the raw error', async () => {
    flow.findItemsToRescue.mockResolvedValue([{ item, contentHash: 'h' }])
    flow.rescueItems.mockRejectedValue(new Error('execution reverted: boom'))
    const { result } = renderFlow(collection, null)
    await act(() => result.current.start())
    await act(() => result.current.runRescue())
    expect(result.current.view).toEqual({
      kind: 'error',
      step: 'rescue',
      detail: 'execution reverted: boom',
      failed: []
    })
  })

  it('goes back to the step when the curator rejects the wallet prompt', async () => {
    auth.sendContractTransaction.mockRejectedValue({ code: 4001 })
    const { result } = renderFlow()
    await act(() => result.current.start())
    await act(() => result.current.runApprove())
    expect(result.current.view).toEqual({ kind: 'step', step: 'approve', phase: { kind: 'idle' } })
  })

  it('mirrors the wallet prompt, and ignores it once the curator backs out', async () => {
    let sign: (txHash: string) => void = () => undefined
    auth.sendContractTransaction.mockReturnValue(new Promise<string>(resolve => (sign = resolve)))
    const { result } = renderFlow()
    await act(() => result.current.start())
    let approving: Promise<void> = Promise.resolve()
    act(() => {
      approving = result.current.runApprove()
    })
    expect(result.current.view).toMatchObject({ phase: { kind: 'signing', tx: 1, txs: 1 } })

    act(() => result.current.cancelSigning())
    await act(async () => {
      sign('0xtx')
      await approving
    })
    expect(result.current.view).toEqual({ kind: 'step', step: 'approve', phase: { kind: 'idle' } })
  })
})
