import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { type Collection } from '~/lib/collections'

const api = vi.hoisted(() => ({ fetchAllCollections: vi.fn() }))
vi.mock('~/lib/builder', async importOriginal => ({ ...(await importOriginal<object>()), ...api }))
const track = vi.hoisted(() => vi.fn())
vi.mock('~/lib/analytics', () => ({ track }))

const { useCollectionByContractLink } = await import('./useCollectionByContractLink')

const OWNER = '0x00000000000000000000000000000000000000aa'
const CONTRACT = '0x1d9fB685c257E74F869BA302e260C0B68f5eBb37'
const collections = [{ id: 'draft-1' }, { id: 'hats-1', contractAddress: CONTRACT.toLowerCase() }] as Collection[]

function renderLink(address: string | undefined, url = `/collections?contract=${CONTRACT}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(
    () => {
      const link = useCollectionByContractLink(address)
      const location = useLocation()
      return { ...link, url: `${location.pathname}${location.search}` }
    },
    { wrapper }
  )
}

beforeEach(() => {
  api.fetchAllCollections.mockReset().mockResolvedValue(collections)
  track.mockReset()
})

describe('when a signed-in creator opens a contract link', () => {
  it('opens the detail of their collection deployed at that address', async () => {
    const { result } = renderLink(OWNER)
    expect(result.current.isResolving).toBe(true)

    await waitFor(() => expect(result.current.url).toBe('/collections/hats-1'))
    expect(track).toHaveBeenCalledWith('Open collection by contract', { found: true, collectionId: 'hats-1' })
  })

  it('stays on the list, keeping the other params, when none of their collections is at that address', async () => {
    api.fetchAllCollections.mockResolvedValue([collections[0]])
    const { result } = renderLink(OWNER, `/collections?status=draft&contract=${CONTRACT}`)

    await waitFor(() => expect(result.current.url).toBe('/collections?status=draft'))
    expect(result.current.isResolving).toBe(false)
    expect(track).toHaveBeenCalledWith('Open collection by contract', { found: false })
  })

  it('stays on the list when their collections cannot be read', async () => {
    api.fetchAllCollections.mockRejectedValue(new Error('boom'))
    const { result } = renderLink(OWNER)

    await waitFor(() => expect(result.current.url).toBe('/collections'))
  })
})

describe('when a signed-out visitor opens a contract link', () => {
  it('keeps the link so it resolves after signing in', () => {
    const { result } = renderLink(undefined)

    expect(result.current.url).toBe(`/collections?contract=${CONTRACT}`)
    expect(result.current.isResolving).toBe(false)
    expect(api.fetchAllCollections).not.toHaveBeenCalled()
  })
})

describe('when the list is opened without a contract link', () => {
  it('reads nothing extra', () => {
    renderLink(OWNER, '/collections')

    expect(api.fetchAllCollections).not.toHaveBeenCalled()
  })
})
