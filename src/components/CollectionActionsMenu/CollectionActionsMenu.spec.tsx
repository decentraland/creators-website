import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TranslationProvider } from '~/intl'
import { type Collection } from '~/lib/collections'
import { useNotifications } from '~/lib/notifications'
import { CollectionActionsMenu } from './CollectionActionsMenu'

vi.mock('~/lib/builder', () => ({ deleteCollection: vi.fn() }))
vi.mock('~/lib/clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }))

import { deleteCollection } from '~/lib/builder'
import { copyToClipboard } from '~/lib/clipboard'

const OWNER = '0xabc'

const draft: Collection = {
  id: 'c1',
  name: 'Pirate Hats',
  owner: OWNER,
  urn: 'urn:decentraland:amoy:collections-v2:0xcontract',
  contractAddress: '0xcontract',
  isPublished: false,
  isApproved: false,
  itemCount: 2,
  minters: [],
  managers: [],
  createdAt: 1000,
  updatedAt: 1000
}

const onDeleted = vi.fn()

function renderMenu(
  collection: Collection,
  address = OWNER,
  props: Partial<Parameters<typeof CollectionActionsMenu>[0]> = {}
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <MemoryRouter initialEntries={['/collections/c1']}>
          <Routes>
            <Route path="/collections/c1" element={children} />
            <Route path="/collections" element={<div data-testid="collections-page" />} />
          </Routes>
        </MemoryRouter>
      </TranslationProvider>
    </QueryClientProvider>
  )
  return render(<CollectionActionsMenu collection={collection} address={address} onDeleted={onDeleted} {...props} />, {
    wrapper
  })
}

async function openMenu() {
  await userEvent.click(screen.getByTestId('collection-actions'))
  return screen.getByTestId('collection-actions-menu')
}

describe('CollectionActionsMenu', () => {
  beforeEach(() => {
    useNotifications.setState({ toasts: [] })
    ;(deleteCollection as Mock).mockReset()
    ;(copyToClipboard as Mock).mockClear()
    onDeleted.mockClear()
  })

  it('offers only deletion for a draft, and deletes after confirmation', async () => {
    ;(deleteCollection as Mock).mockResolvedValue(undefined)
    renderMenu(draft)
    await openMenu()
    expect(screen.getByTestId('delete-collection')).toBeInTheDocument()
    expect(screen.queryByTestId('copy-urn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('manage-minters')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('delete-collection'))
    expect(screen.getByTestId('delete-collection-modal-description')).toHaveTextContent('Pirate Hats')
    await userEvent.click(screen.getByTestId('delete-collection-confirm'))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(deleteCollection).toHaveBeenCalledWith(OWNER, 'c1')
    expect(useNotifications.getState().toasts[0]?.message).toMatch(/deleted/i)
  })

  it('keeps the dialog open and reports the failure when deletion is rejected', async () => {
    ;(deleteCollection as Mock).mockRejectedValue(new Error('locked'))
    renderMenu(draft)
    await openMenu()
    await userEvent.click(screen.getByTestId('delete-collection'))
    await userEvent.click(screen.getByTestId('delete-collection-confirm'))
    await waitFor(() => expect(useNotifications.getState().toasts).toHaveLength(1))
    expect(screen.getByTestId('delete-collection-modal')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('renders nothing for a draft under the publish lock', () => {
    renderMenu({ ...draft, lock: Date.now() })
    expect(screen.queryByTestId('collection-actions')).not.toBeInTheDocument()
  })

  it('lets anyone with access copy the URN and address once the collection is on-chain', async () => {
    renderMenu({ ...draft, isPublished: true }, '0xmanager')
    await openMenu()
    expect(screen.queryByTestId('delete-collection')).not.toBeInTheDocument()
    expect(screen.queryByTestId('manage-collaborators')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('copy-urn'))
    expect(copyToClipboard).toHaveBeenCalledWith(draft.urn)
    await waitFor(() => expect(useNotifications.getState().toasts[0]?.message).toMatch(/urn/i))
    expect(screen.queryByTestId('collection-actions-menu')).not.toBeInTheDocument()

    await openMenu()
    await userEvent.click(screen.getByTestId('copy-address'))
    expect(copyToClipboard).toHaveBeenCalledWith('0xcontract')
  })

  it('shows the role placeholders only to the owner of an on-chain collection', async () => {
    renderMenu({ ...draft, isPublished: true })
    await openMenu()
    expect(screen.getByTestId('manage-collaborators')).toHaveAttribute('aria-disabled')
    expect(screen.getByTestId('manage-minters')).toHaveAttribute('aria-disabled')
  })

  it('hides the role placeholders when asked, even for the owner', async () => {
    renderMenu({ ...draft, isPublished: true }, OWNER, { showRoles: false })
    await openMenu()
    expect(screen.getByTestId('copy-urn')).toBeInTheDocument()
    expect(screen.queryByTestId('manage-collaborators')).not.toBeInTheDocument()
    expect(screen.queryByTestId('manage-minters')).not.toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    renderMenu(draft)
    await openMenu()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('collection-actions-menu')).not.toBeInTheDocument()
  })
})
