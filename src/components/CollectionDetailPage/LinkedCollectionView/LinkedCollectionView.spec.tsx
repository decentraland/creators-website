import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TranslationProvider } from '~/intl'
import { CurationStatus, type Collection } from '~/lib/collections'
import { ItemType, type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { LinkedCollectionView } from './LinkedCollectionView'

vi.mock('~/lib/builder', () => ({
  fetchItemCurations: vi.fn(),
  getContentsStorageUrl: (hash: string) => `https://builder.example/storage/${hash}`
}))
vi.mock('~/lib/clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }))
vi.mock('~/lib/navigation', () => ({ openExternal: vi.fn() }))

import { fetchItemCurations } from '~/lib/builder'
import { copyToClipboard } from '~/lib/clipboard'
import { openExternal } from '~/lib/navigation'

const OWNER = '0xabc'
const CONTRACT = '0x1d9fb685c257e74f869ba302e260c0b68f5ebb37'

const collection: Collection = {
  id: 'c1',
  name: 'Brand Hats',
  owner: OWNER,
  urn: 'urn:decentraland:amoy:collections-thirdparty:brand:hats',
  isPublished: true,
  isApproved: true,
  itemCount: 2,
  minters: [],
  managers: [],
  linkedContractAddress: CONTRACT,
  linkedContractNetwork: 'amoy',
  createdAt: 1000,
  updatedAt: 1000
}

function item(id: string, name: string, mappings: unknown): Item {
  return {
    id,
    name,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: OWNER,
    collectionId: 'c1',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    mappings,
    type: ItemType.WEARABLE,
    data: { category: 'hat', representations: [], replaces: [], hides: [], tags: [] },
    contents: { 'thumbnail.png': 'Qmthumb' },
    createdAt: 1000,
    updatedAt: 1000
  }
}

const items = [
  item('i1', 'Gold Hat', { amoy: { [CONTRACT]: [{ type: 'any' }] } }),
  item('i2', 'Silver Hat', { amoy: { [CONTRACT]: [{ type: 'range', from: '1', to: '50' }] } })
]

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </TranslationProvider>
    </QueryClientProvider>
  )
  return render(
    <LinkedCollectionView
      collection={collection}
      thirdPartyName="Brand X"
      items={items}
      address={OWNER}
      page={1}
      onBack={vi.fn()}
      onPageChange={vi.fn()}
    />,
    { wrapper }
  )
}

describe('LinkedCollectionView', () => {
  beforeEach(() => {
    useNotifications.setState({ toasts: [] })
    ;(fetchItemCurations as Mock).mockResolvedValue(new Map([['i1', CurationStatus.APPROVED]]))
  })

  it('shows the linked contract and links to the legacy builder for editing', async () => {
    renderView()
    expect(screen.getByTestId('linked-third-party')).toHaveTextContent('Brand X')
    expect(screen.getByTestId('linked-network')).toHaveTextContent('Amoy')
    expect(screen.getByTestId('linked-contract-address')).toHaveTextContent('0x1d9f…bb37')
    await userEvent.click(screen.getByTestId('edit-in-builder'))
    expect(openExternal).toHaveBeenCalledWith(expect.stringMatching(/\/builder\/thirdPartyCollections\/c1$/))
  })

  it('shows each item with its curation status and token mapping', async () => {
    renderView()
    expect(screen.getAllByTestId('linked-item-row')).toHaveLength(2)
    expect(screen.getByTestId('linked-item-count')).toHaveTextContent('2 Items')
    expect(screen.queryByTestId('type-filters')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('linked-item-status')).toHaveLength(2))
    const [gold, silver] = screen.getAllByTestId('linked-item-status')
    expect(gold).toHaveAttribute('data-status', 'published')
    expect(silver).toHaveAttribute('data-status', 'not_published')
    const [goldMapping, silverMapping] = screen.getAllByTestId('linked-item-mapping')
    expect(goldMapping).toHaveTextContent('Any token')
    expect(silverMapping).toHaveTextContent('Tokens #1–#50')
  })

  it('offers a retry when the item statuses fail to load', async () => {
    ;(fetchItemCurations as Mock).mockRejectedValueOnce(new Error('boom'))
    renderView()
    const [retry] = await screen.findAllByTestId('linked-item-status-retry')
    await userEvent.click(retry)
    await waitFor(() => expect(screen.getAllByTestId('linked-item-status')).toHaveLength(2))
  })

  it('offers no editing actions', () => {
    renderView()
    expect(screen.queryByTestId('rename-collection')).not.toBeInTheDocument()
    expect(screen.queryByTestId('publish-collection')).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-items')).not.toBeInTheDocument()
    expect(screen.queryByTestId('open-editor')).not.toBeInTheDocument()
  })

  it('copies the contract address', async () => {
    renderView()
    await userEvent.click(screen.getByTestId('copy-linked-contract'))
    expect(copyToClipboard).toHaveBeenCalledWith(CONTRACT)
    await waitFor(() => expect(useNotifications.getState().toasts[0]?.message).toMatch(/copied/i))
  })
})
