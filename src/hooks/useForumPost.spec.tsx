import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'

const api = vi.hoisted(() => ({
  createCollectionForumPost: vi.fn(),
  createCurationForumReply: vi.fn()
}))
vi.mock('~/lib/builder', async importOriginal => ({ ...(await importOriginal<object>()), ...api }))
vi.mock('~/hooks/useProfile', () => ({
  profileQuery: (address: string) => ({ queryKey: ['profile', address], queryFn: () => ({ name: 'Ana' }) })
}))
const analytics = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('~/lib/analytics', () => ({ track: analytics.track, errorCode: () => 'unknown' }))
const monitoring = vi.hoisted(() => ({ captureError: vi.fn() }))
vi.mock('~/lib/monitoring', () => monitoring)

const { postCollectionToForum, useForumPostRecovery } = await import('./useForumPost')

const OWNER = '0x00000000000000000000000000000000000000aa'
const collection = {
  id: 'c1',
  name: 'Hats',
  owner: OWNER,
  isPublished: true,
  isApproved: false,
  managers: [],
  minters: [],
  updatedAt: Date.now() - 60 * 60_000
} as unknown as Collection
const syncedItem = {
  id: 'i1',
  name: 'Hat',
  description: '',
  tokenId: '1',
  thumbnail: 't.png',
  contents: { 't.png': 'hash' },
  data: {}
} as unknown as Item
const LINK = 'https://forum.decentraland.org/t/hats/77'

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  Object.values(api).forEach(fn => fn.mockReset())
  analytics.track.mockReset()
  monitoring.captureError.mockReset()
  api.createCollectionForumPost.mockResolvedValue(LINK)
})

describe('postCollectionToForum', () => {
  it('opens the topic and stores its link on the collection', async () => {
    client.setQueryData(['collection', OWNER, 'c1'], collection)

    await postCollectionToForum(client, OWNER, collection, 'publish')

    expect(api.createCollectionForumPost).toHaveBeenCalledWith(OWNER, 'c1')
    expect(client.getQueryData<Collection>(['collection', OWNER, 'c1'])?.forumLink).toBe(LINK)
    expect(analytics.track).toHaveBeenCalledWith('Create forum post', { collectionId: 'c1', source: 'publish' })
  })

  it('never stores a link that is not a web page', async () => {
    client.setQueryData(['collection', OWNER, 'c1'], collection)
    api.createCollectionForumPost.mockResolvedValue('javascript:alert(1)')

    await postCollectionToForum(client, OWNER, collection, 'publish')

    expect(client.getQueryData<Collection>(['collection', OWNER, 'c1'])?.forumLink).toBeUndefined()
  })

  it('reports a post that could not be created without throwing', async () => {
    api.createCollectionForumPost.mockRejectedValue(new Error('down'))
    vi.useFakeTimers()
    const done = postCollectionToForum(client, OWNER, collection, 'publish')
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()

    expect(monitoring.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ flow: 'forum_post' })
    )
  })
})

describe('useForumPostRecovery', () => {
  it('posts once for a synced collection waiting for review that has no topic', async () => {
    const { rerender, unmount } = renderHook(() => useForumPostRecovery(OWNER, { ...collection }, [syncedItem]), {
      wrapper
    })
    rerender()
    unmount()
    renderHook(() => useForumPostRecovery(OWNER, { ...collection }, [syncedItem]), { wrapper })

    await waitFor(() => expect(api.createCollectionForumPost).toHaveBeenCalledTimes(1))
  })

  it('leaves alone collections that have a topic, are approved, just published, not synced, or someone else’s', () => {
    renderHook(() => useForumPostRecovery(OWNER, { ...collection, id: 'c2', updatedAt: Date.now() }, [syncedItem]), {
      wrapper
    })
    renderHook(() => useForumPostRecovery(OWNER, { ...collection, forumLink: LINK }, [syncedItem]), { wrapper })
    renderHook(() => useForumPostRecovery(OWNER, { ...collection, isApproved: true }, [syncedItem]), { wrapper })
    renderHook(() => useForumPostRecovery(OWNER, collection, [{ ...syncedItem, tokenId: undefined }]), { wrapper })
    renderHook(() => useForumPostRecovery('0xsomeoneelse', collection, [syncedItem]), { wrapper })

    expect(api.createCollectionForumPost).not.toHaveBeenCalled()
  })
})
