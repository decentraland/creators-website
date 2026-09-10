import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type Entity, EntityType } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { type Collection } from '~/lib/collections'
import { ItemSyncStatus } from '~/lib/itemSync'
import { ItemType, type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { ItemActionsMenu } from './ItemActionsMenu'

vi.mock('~/lib/builder', () => ({
  saveItem: vi.fn(),
  deleteItem: vi.fn(),
  fetchCollections: vi.fn(),
  fetchCollectionCuration: vi.fn()
}))
vi.mock('~/lib/catalyst', () => ({ fetchCatalystContent: vi.fn() }))
vi.mock('~/lib/clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }))

import { deleteItem, fetchCollections, saveItem } from '~/lib/builder'
import { fetchCatalystContent } from '~/lib/catalyst'
import { copyToClipboard } from '~/lib/clipboard'

const OWNER = '0xowner'
const MANAGER = '0xmanager'
const MINTER = '0xminter'

const draft: Collection = {
  id: 'c1',
  name: 'Pirate Hats',
  owner: OWNER,
  urn: 'urn:decentraland:amoy:collections-v2:0xc0ffee',
  isPublished: false,
  isApproved: false,
  itemCount: 2,
  minters: [MINTER],
  managers: [MANAGER],
  createdAt: 1000,
  updatedAt: 1000
}
const published: Collection = { ...draft, isPublished: true, isApproved: true, contractAddress: '0xc0ffee' }

const item: Item = {
  id: 'i1',
  name: 'Pirate Hat',
  description: 'Yarr',
  thumbnail: 'thumbnail.png',
  owner: OWNER,
  collectionId: 'c1',
  rarity: 'legendary',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: { category: 'hat', representations: [{ bodyShapes: [], mainFile: 'hat.glb', contents: ['hat.glb'] }] },
  contents: { 'hat.glb': 'Qmglb', 'thumbnail.png': 'Qmthumb' },
  createdAt: 1000,
  updatedAt: 1000
}
const publishedItem: Item = { ...item, isPublished: true, isApproved: true, urn: `${draft.urn}:0`, tokenId: '0' }

const entity: Entity = {
  version: 'v3',
  id: 'bafyentity',
  type: EntityType.WEARABLE,
  pointers: [publishedItem.urn!],
  timestamp: 1,
  content: [
    { file: 'hat.glb', hash: 'Qmapproved' },
    { file: 'thumbnail.png', hash: 'Qmthumb' }
  ],
  metadata: { id: publishedItem.urn, name: 'Approved Hat', description: 'Yarr', data: item.data }
}

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

type Props = Partial<Parameters<typeof ItemActionsMenu>[0]>

function renderMenu(props: Props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <MemoryRouter initialEntries={['/collections/c1']}>
          <Routes>
            <Route path="/collections/c1" element={children} />
            <Route path="/collections/editor" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </TranslationProvider>
    </QueryClientProvider>
  )
  return render(<ItemActionsMenu item={item} collection={draft} address={OWNER} {...props} />, { wrapper })
}

async function openMenu() {
  await userEvent.click(screen.getByTestId('item-actions'))
  return screen.getByTestId('item-actions-menu')
}

const ids = (menu: HTMLElement) =>
  Array.from(menu.querySelectorAll('[role="menuitem"]')).map(el => el.getAttribute('data-testid'))

function stubViewport(compact: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: compact, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  )
}

afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  useNotifications.setState({ toasts: [] })
  vi.mocked(saveItem).mockReset()
  vi.mocked(deleteItem).mockReset()
  vi.mocked(fetchCollections).mockReset()
  vi.mocked(fetchCatalystContent).mockReset()
  vi.mocked(copyToClipboard).mockClear()
})

describe('ItemActionsMenu', () => {
  it('offers preview, move and delete on a draft item the creator owns, and no URN before publishing', async () => {
    renderMenu()
    expect(ids(await openMenu())).toEqual(['item-preview', 'item-move', 'item-delete'])
  })

  it('lets a collaborator manage the items but a minter only preview them', async () => {
    renderMenu({ address: MANAGER })
    expect(ids(await openMenu())).toEqual(['item-preview', 'item-move', 'item-delete'])
    await userEvent.keyboard('{Escape}')

    renderMenu({ address: MINTER })
    const menus = await screen.findAllByTestId('item-actions')
    await userEvent.click(menus[1])
    expect(ids(screen.getByTestId('item-actions-menu'))).toEqual(['item-preview'])
  })

  it('opens the item in the editor', async () => {
    renderMenu()
    await openMenu()
    await userEvent.click(screen.getByTestId('item-preview'))
    expect(screen.getByTestId('location')).toHaveTextContent('/collections/editor?collection=c1&item=i1')
  })

  it('copies the URN of a published item and offers the sale placeholders once the collection is on the market', async () => {
    renderMenu({
      item: publishedItem,
      collection: published,
      listing: { itemId: '0', currency: 'credits', credits: 5 }
    })
    const menu = await openMenu()
    expect(ids(menu)).toEqual(['item-copy-urn', 'item-preview', 'item-edit-price', 'item-remove-from-sale'])
    expect(screen.getByTestId('item-edit-price')).toHaveAttribute('aria-disabled')
    expect(screen.getByTestId('item-remove-from-sale')).toHaveAttribute('aria-disabled')

    await userEvent.click(screen.getByTestId('item-copy-urn'))
    expect(copyToClipboard).toHaveBeenCalledWith(publishedItem.urn)
    await waitFor(() => expect(useNotifications.getState().toasts[0]?.message).toMatch(/urn/i))
    expect(screen.queryByTestId('item-actions-menu')).not.toBeInTheDocument()
  })

  it('has no remove-from-sale for an item that is not on sale', async () => {
    renderMenu({ item: publishedItem, collection: published, listing: null })
    expect(ids(await openMenu())).toEqual(['item-copy-urn', 'item-preview', 'item-edit-price'])
  })

  it('moves the item to another draft collection', async () => {
    const other: Collection = { ...draft, id: 'c2', name: 'Parrots' }
    const locked: Collection = { ...draft, id: 'c3', name: 'Locked', lock: Date.now() }
    let resolveDrafts!: (value: Awaited<ReturnType<typeof fetchCollections>>) => void
    vi.mocked(fetchCollections).mockReturnValue(new Promise(resolve => (resolveDrafts = resolve)))
    vi.mocked(saveItem).mockImplementation(async (_address, saved) => saved)
    renderMenu()
    await openMenu()
    await userEvent.click(screen.getByTestId('item-move'))
    expect(screen.getByTestId('move-item-modal-description')).toHaveTextContent('Pirate Hat')
    expect(screen.getByTestId('move-item-confirm')).toBeDisabled()
    expect(screen.getByTestId('move-item-loading')).toBeInTheDocument()

    resolveDrafts({ results: [draft, other, locked], total: 3, page: 1, pages: 1, limit: 1000 })
    await userEvent.click(await screen.findByTestId('move-item-target'))
    expect(screen.queryByTestId('move-item-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('move-item-target-option-c1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('move-item-target-option-c3')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('move-item-target-option-c2'))
    await userEvent.click(screen.getByTestId('move-item-confirm'))

    await waitFor(() => expect(screen.queryByTestId('move-item-modal')).not.toBeInTheDocument())
    expect(saveItem).toHaveBeenCalledWith(OWNER, { ...item, collectionId: 'c2' }, {})
    expect(useNotifications.getState().toasts[0]?.message).toMatch(/Parrots/)
  })

  it('explains when there is no other draft to move to', async () => {
    vi.mocked(fetchCollections).mockResolvedValue({ results: [draft], total: 1, page: 1, pages: 1, limit: 1000 })
    renderMenu()
    await openMenu()
    await userEvent.click(screen.getByTestId('item-move'))
    expect(await screen.findByTestId('move-item-empty')).toBeInTheDocument()
    expect(screen.getByTestId('move-item-confirm')).toBeDisabled()
  })

  it('resets an unsynced item to the approved version deployed on the catalyst', async () => {
    const edited = {
      ...publishedItem,
      name: 'Edited Hat',
      contents: { ...publishedItem.contents, 'hat.glb': 'Qmedited' }
    }
    vi.mocked(fetchCatalystContent).mockImplementation(async hash => new Blob([hash]))
    vi.mocked(saveItem).mockImplementation(async (_address, saved) => saved)
    renderMenu({ item: edited, collection: published, sync: { status: ItemSyncStatus.UNSYNCED, entity } })
    await openMenu()
    await userEvent.click(screen.getByTestId('item-reset'))
    expect(screen.getByTestId('reset-item-modal-description')).toHaveTextContent('Edited Hat')
    await userEvent.click(screen.getByTestId('reset-item-confirm'))

    await waitFor(() => expect(screen.queryByTestId('reset-item-modal')).not.toBeInTheDocument())
    const [, saved, blobs] = vi.mocked(saveItem).mock.calls[0]
    expect(saved).toMatchObject({
      id: 'i1',
      name: 'Approved Hat',
      contents: { 'hat.glb': 'Qmapproved', 'thumbnail.png': 'Qmthumb' }
    })
    expect(Object.keys(blobs).sort()).toEqual(['hat.glb', 'thumbnail.png'])
    expect(fetchCatalystContent).toHaveBeenCalledWith('Qmapproved')
    expect(useNotifications.getState().toasts[0]?.message).toMatch(/reset/i)
  })

  it('offers no reset while the item is synced or under review', async () => {
    renderMenu({ item: publishedItem, collection: published, sync: { status: ItemSyncStatus.SYNCED, entity } })
    expect(ids(await openMenu())).not.toContain('item-reset')
    await userEvent.keyboard('{Escape}')

    renderMenu({ item: publishedItem, collection: published, sync: { status: ItemSyncStatus.UNDER_REVIEW, entity } })
    const menus = await screen.findAllByTestId('item-actions')
    await userEvent.click(menus[1])
    expect(ids(screen.getByTestId('item-actions-menu'))).not.toContain('item-reset')
  })

  it('deletes a draft item after confirmation', async () => {
    vi.mocked(deleteItem).mockResolvedValue(undefined)
    renderMenu()
    await openMenu()
    await userEvent.click(screen.getByTestId('item-delete'))
    expect(screen.getByTestId('delete-item-modal-description')).toHaveTextContent('Pirate Hat')
    await userEvent.click(screen.getByTestId('delete-item-confirm'))

    await waitFor(() => expect(screen.queryByTestId('delete-item-modal')).not.toBeInTheDocument())
    expect(deleteItem).toHaveBeenCalledWith(OWNER, 'i1')
    expect(useNotifications.getState().toasts[0]?.message).toMatch(/deleted/i)
  })

  it('keeps the delete dialog open and shows the failure when the server refuses', async () => {
    vi.mocked(deleteItem).mockRejectedValue(new Error('locked'))
    renderMenu()
    await openMenu()
    await userEvent.click(screen.getByTestId('item-delete'))
    await userEvent.click(screen.getByTestId('delete-item-confirm'))
    expect(await screen.findByTestId('delete-item-modal-error')).toBeInTheDocument()
    expect(screen.getByTestId('delete-item-modal')).toBeInTheDocument()
  })

  describe('on a small screen', () => {
    beforeEach(() => stubViewport(true))

    it('keeps only copy URN and the sale actions', async () => {
      renderMenu({
        item: publishedItem,
        collection: published,
        listing: { itemId: '0', currency: 'mana', manaWei: 1n }
      })
      expect(ids(await openMenu())).toEqual(['item-copy-urn', 'item-edit-price', 'item-remove-from-sale'])
    })

    it('hides the menu entirely for a draft item, which has nothing left to offer', () => {
      renderMenu()
      expect(screen.queryByTestId('item-actions')).not.toBeInTheDocument()
    })
  })
})
