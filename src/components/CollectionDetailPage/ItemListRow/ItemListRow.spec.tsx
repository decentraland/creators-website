import { describe, it, expect } from 'vitest'
import { type ComponentProps, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { ItemType, type Item } from '~/lib/items'
import { type ItemListing } from '~/lib/listings'
import { ItemListRow } from './ItemListRow'

const item: Item = {
  id: 'i1',
  name: 'Pirate Hat',
  description: 'Yarr',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  collectionId: 'c1',
  rarity: 'legendary',
  isPublished: true,
  isApproved: true,
  inCatalyst: true,
  type: ItemType.WEARABLE,
  data: {
    category: 'upper_body',
    representations: [
      {
        bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseFemale'],
        mainFile: 'hat.glb',
        contents: ['hat.glb']
      }
    ]
  },
  contents: { 'thumbnail.png': 'Qmthumb' },
  createdAt: 1000,
  updatedAt: 1000
}

type RowProps = Omit<ComponentProps<typeof ItemListRow>, 'item'>

function renderRow(overrides: Partial<Item> = {}, props: RowProps | boolean = {}) {
  const rowProps = typeof props === 'boolean' ? { withPlayMode: props } : props
  const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>
  return render(<ItemListRow item={{ ...item, ...overrides }} {...rowProps} />, { wrapper })
}

const creditsListing: ItemListing = {
  itemId: '3',
  currency: 'credits',
  credits: 500,
  manaWei: null,
  available: 85,
  free: false
}
const manaListing: ItemListing = { ...creditsListing, currency: 'mana', credits: 12, manaWei: '5000000000000000000' }

const emote: Partial<Item> = {
  type: ItemType.EMOTE,
  data: { category: 'dance', representations: [], loop: true }
}

describe('ItemListRow', () => {
  it('shows name, body shape, category and rarity with its supply', () => {
    renderRow()
    expect(screen.getByText('Pirate Hat')).toBeInTheDocument()
    expect(screen.getByTestId('item-row-body-shape')).toHaveTextContent('Female')
    expect(screen.getByRole('img', { name: 'Female' })).toBeInTheDocument()
    expect(screen.getByTestId('item-row-category')).toHaveTextContent('Upper Body')
    expect(screen.getByRole('img', { name: 'Upper Body' })).toBeInTheDocument()
    expect(screen.getByTestId('item-row-rarity')).toHaveTextContent(/legendary \(100\)/i)
    expect(screen.queryByTestId('item-row-status')).not.toBeInTheDocument()
  })

  it('resolves the thumbnail through storage', () => {
    renderRow()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const img = screen.getByTestId('item-row').querySelector('img')
    expect(img?.src).toContain('/storage/contents/Qmthumb')
  })

  it('shows placeholders for missing fields', () => {
    renderRow({
      rarity: undefined,
      data: { representations: [] }
    })
    expect(screen.getByTestId('item-row-body-shape')).toHaveTextContent('—')
    expect(screen.getByTestId('item-row-category')).toHaveTextContent('—')
    expect(screen.getByTestId('item-row-rarity')).toBeEmptyDOMElement()
  })

  it('omits the play mode cell when the list has no emotes', () => {
    renderRow()
    expect(screen.queryByTestId('item-row-play-mode')).not.toBeInTheDocument()
  })

  it('shows the emote play mode between category and rarity when the list has emotes', () => {
    renderRow(emote, true)
    const cell = screen.getByTestId('item-row-play-mode')
    expect(cell).toHaveTextContent('Loop')
    expect(cell.nextElementSibling).toBe(screen.getByTestId('item-row-rarity'))
    expect(cell.previousElementSibling).toBe(screen.getByTestId('item-row-category'))
  })

  it('shows play once for a non-looping emote', () => {
    renderRow({ ...emote, data: { ...emote.data!, loop: false } }, true)
    expect(screen.getByTestId('item-row-play-mode')).toHaveTextContent('Play Once')
  })

  it('shows a dash for a wearable in a list with emotes', () => {
    renderRow({}, true)
    expect(screen.getByTestId('item-row-play-mode')).toHaveTextContent('—')
  })

  it('has no price or sales cells while the collection has not been published', () => {
    renderRow()
    expect(screen.queryByTestId('item-row-price')).not.toBeInTheDocument()
    expect(screen.queryByTestId('item-row-sales')).not.toBeInTheDocument()
  })

  it('shows a credits price and the minted count over the max supply after rarity', () => {
    renderRow({ tokenId: '3', totalSupply: 15 }, { withMarket: true, listing: creditsListing })
    const price = screen.getByTestId('item-row-price')
    expect(price).toHaveTextContent('500')
    expect(price).toHaveAttribute('data-currency', 'credits')
    expect(price.previousElementSibling).toBe(screen.getByTestId('item-row-rarity'))
    expect(screen.getByTestId('item-row-sales')).toHaveTextContent('15/100')
  })

  it('shows a MANA price for a listing made from the legacy marketplace', () => {
    renderRow({ tokenId: '3' }, { withMarket: true, listing: manaListing })
    const price = screen.getByTestId('item-row-price')
    expect(price).toHaveTextContent('5')
    expect(price).toHaveAttribute('data-currency', 'mana')
    expect(screen.getByTestId('item-row-sales')).toHaveTextContent('0/100')
  })

  it('shows Free for a listing priced at zero', () => {
    renderRow({ tokenId: '3' }, { withMarket: true, listing: { ...creditsListing, credits: 0, free: true } })
    expect(screen.getByTestId('item-row-price')).toHaveTextContent('Free')
  })

  it('shows a dash for an item that is not on sale', () => {
    renderRow({ tokenId: '3' }, { withMarket: true, listing: null })
    expect(screen.getByTestId('item-row-price')).toHaveTextContent('—')
    expect(screen.getByTestId('item-row-sales')).toHaveTextContent('0/100')
  })

  it('shows a dash instead of a price once the item is sold out', () => {
    renderRow({ tokenId: '3', totalSupply: 100 }, { withMarket: true, listing: creditsListing })
    expect(screen.getByTestId('item-row-price')).toHaveTextContent('—')
    expect(screen.getByTestId('item-row-sales')).toHaveTextContent('100/100')
    expect(screen.getByTestId('item-row-sales')).toHaveAttribute('data-sold-out')
  })

  it('leaves the price blank while listings are loading', () => {
    renderRow({ tokenId: '3' }, { withMarket: true })
    expect(screen.getByTestId('item-row-price')).toBeEmptyDOMElement()
  })
})
