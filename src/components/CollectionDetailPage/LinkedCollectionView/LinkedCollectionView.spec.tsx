import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type Mappings } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { CurationStatus, type Collection } from '~/lib/collections'
import { ItemType, type Item } from '~/lib/items'
import { type ItemCuration, type LinkedItemsQuery } from '~/lib/linkedItemStatus'
import { type ThirdParty } from '~/lib/thirdParty'
import { LinkedCollectionView } from './LinkedCollectionView'

vi.mock('~/lib/builder', async importOriginal => ({
  ...(await importOriginal<typeof import('~/lib/builder')>()),
  fetchLinkedCollectionItems: vi.fn(),
  fetchAllLinkedCollectionItems: vi.fn(),
  fetchItemCurations: vi.fn()
}))

import { fetchAllLinkedCollectionItems, fetchItemCurations, fetchLinkedCollectionItems } from '~/lib/builder'

const ADDRESS = '0xabc0000000000000000000000000000000000001'
const CONTRACT = '0x1d9fb685c257e74f869ba302e260c0b68f5ebb37'
const session = { address: ADDRESS } as unknown as Session

const collection: Collection = {
  id: 'c1',
  name: 'Brand Hats',
  owner: '',
  urn: 'urn:decentraland:amoy:collections-thirdparty:brand:hats',
  isPublished: true,
  isApproved: false,
  itemCount: 3,
  minters: [],
  managers: [],
  linkedContractAddress: CONTRACT,
  linkedContractNetwork: 'amoy',
  isMappingComplete: true,
  createdAt: 1000,
  updatedAt: 1000
}

const thirdParty: ThirdParty = {
  id: 'urn:decentraland:amoy:collections-thirdparty:brand',
  root: '',
  managers: [ADDRESS],
  name: 'Brand X',
  description: '',
  isApproved: true,
  isProgrammatic: false,
  maxItems: '10',
  contracts: [],
  published: true
}

const mapped = { amoy: { [CONTRACT]: [{ type: 'any' }] } } as Mappings

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    name: `Hat ${id}`,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: '',
    collectionId: 'c1',
    urn: `${collection.urn}:${id}`,
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    mappings: mapped,
    currentContentHash: `hash-${id}`,
    type: ItemType.WEARABLE,
    data: { category: 'hat', representations: [] },
    contents: { 'thumbnail.png': 'bafthumb' },
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

function approved(id: string): ItemCuration {
  return {
    id: `ic-${id}`,
    itemId: id,
    status: CurationStatus.APPROVED,
    contentHash: `hash-${id}`,
    isMappingComplete: true,
    createdAt: 1,
    updatedAt: 1
  }
}

type Scenario = {
  page: Item[]
  pages?: number
  total?: number
  curations?: Map<string, ItemCuration>
  unsynced?: number
}

function setup({ page, pages = 1, total = page.length, curations = new Map(), unsynced = 0 }: Scenario) {
  vi.mocked(fetchItemCurations).mockResolvedValue(curations)
  vi.mocked(fetchLinkedCollectionItems).mockImplementation(
    async (_address, _collectionId, _page, limit, filter: LinkedItemsQuery = {}) =>
      // One-row pages are the counts behind the Publish button; the rest is the list itself.
      limit === 1
        ? { results: [], total: filter.synced === false ? unsynced : 0, page: 1, pages: 1, limit: 1 }
        : { results: page, total, page: 1, pages, limit }
  )
  vi.mocked(fetchAllLinkedCollectionItems).mockResolvedValue([])
}

function renderView(view: Partial<Collection> = {}) {
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
      collection={{ ...collection, ...view }}
      thirdParty={thirdParty}
      session={session}
      page={1}
      onBack={vi.fn()}
      onPageChange={vi.fn()}
    />,
    { wrapper }
  )
}

async function rows() {
  await waitFor(() => expect(screen.getAllByTestId('linked-item-row').length).toBeGreaterThan(0))
  return screen.getAllByTestId('linked-item-row')
}

describe('LinkedCollectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the third party, its type and the linked contract', async () => {
    setup({ page: [item('1')] })
    renderView()
    expect(screen.getByTestId('linked-third-party')).toHaveTextContent('Brand X')
    expect(screen.getByTestId('third-party-kind')).toHaveTextContent('Standard')
    expect(screen.getByTestId('linked-network')).toHaveTextContent('Amoy')
    await rows()
  })

  it('counts the selected items on the Publish button and lists them in the header row', async () => {
    setup({ page: [item('1'), item('2'), item('3')] })
    renderView()
    const [first, second] = await rows()
    const publish = await screen.findByTestId('publish-linked-items')

    await userEvent.click(within(first).getByTestId('linked-item-select'))
    await userEvent.click(within(second).getByTestId('linked-item-select'))

    expect(publish).toHaveTextContent('Publish (2)')
    expect(screen.getByTestId('linked-selection-count')).toHaveTextContent('2 items selected')

    await userEvent.click(screen.getByTestId('linked-clear-selection'))
    expect(publish).toHaveTextContent(/^Publish$/)
    expect(screen.queryByTestId('linked-selection')).not.toBeInTheDocument()
  })

  it('selects every publishable item across pages, leaving the published ones out', async () => {
    setup({ page: [item('1'), item('2')], pages: 2, total: 4 })
    const everything = [
      item('1'),
      item('2'),
      item('3'),
      item('4', { isPublished: true, isApproved: true, catalystContentHash: 'hash-4' })
    ]
    // Every item has a mapping: only the unfiltered listing (Select all) answers with items.
    vi.mocked(fetchAllLinkedCollectionItems).mockImplementation(async (_address, _id, filter: LinkedItemsQuery = {}) =>
      filter.mappingStatus ? [] : everything
    )
    vi.mocked(fetchItemCurations).mockResolvedValue(new Map([['4', approved('4')]]))
    renderView({ itemCount: 4 })
    await rows()

    await userEvent.click(screen.getByTestId('linked-select-all'))
    await userEvent.click(await screen.findByTestId('linked-select-across'))

    expect(await screen.findByTestId('linked-selection-count')).toHaveTextContent(
      'All 3 publishable items are selected'
    )
    expect(screen.getByTestId('publish-linked-items')).toHaveTextContent('Publish (3)')
  })

  it('offers no Publish button when nothing in the collection can be published or pushed', async () => {
    const published = item('1', { isPublished: true, isApproved: true, catalystContentHash: 'hash-1' })
    setup({ page: [published], curations: new Map([['1', approved('1')]]) })
    renderView({ itemCount: 1 })
    await rows()
    // Both counts behind the button have answered (unpushed changes, items without a mapping).
    await waitFor(() =>
      expect(vi.mocked(fetchLinkedCollectionItems).mock.calls.filter(call => call[3] === 1).length).toBe(2)
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.queryByTestId('publish-linked-items')).not.toBeInTheDocument()
  })

  it('offers Push changes for an approved item edited since its approval', async () => {
    const edited = item('1', {
      isPublished: true,
      isApproved: true,
      catalystContentHash: 'old',
      currentContentHash: 'new'
    })
    setup({ page: [edited], curations: new Map([['1', { ...approved('1'), contentHash: 'old' }]]), unsynced: 1 })
    renderView({ itemCount: 1 })
    const [row] = await rows()
    await userEvent.click(within(row).getByTestId('linked-item-select'))
    expect(await screen.findByTestId('publish-linked-items')).toHaveTextContent('Push changes (1)')
  })

  it('says the items could not load, with a retry, instead of calling the collection empty', async () => {
    setup({ page: [item('1')] })
    const list = vi.mocked(fetchLinkedCollectionItems).getMockImplementation()!
    vi.mocked(fetchLinkedCollectionItems).mockImplementation(async (...args) => {
      if (args[3] !== 1) throw new Error('offline')
      return list(...args)
    })
    renderView()

    expect(await screen.findByTestId('linked-items-error')).toBeInTheDocument()
    expect(screen.queryByTestId('collection-empty')).not.toBeInTheDocument()

    vi.mocked(fetchLinkedCollectionItems).mockImplementation(list)
    await userEvent.click(screen.getByTestId('linked-items-retry'))
    expect(await rows()).toHaveLength(1)
  })

  it('keeps Publish available when counting what is left to publish fails', async () => {
    setup({ page: [item('1')] })
    const list = vi.mocked(fetchLinkedCollectionItems).getMockImplementation()!
    vi.mocked(fetchLinkedCollectionItems).mockImplementation(async (...args) => {
      if (args[3] === 1) throw new Error('offline')
      return list(...args)
    })
    renderView()

    expect(await screen.findByTestId('publish-linked-items')).toBeInTheDocument()
  })
})
