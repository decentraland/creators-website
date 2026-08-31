import { describe, it, expect } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '~/intl'
import { ItemType, type Item } from '~/lib/items'
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

function renderRow(overrides: Partial<Item> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TranslationProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </TranslationProvider>
  )
  return render(<ItemListRow item={{ ...item, ...overrides }} />, { wrapper })
}

describe('ItemListRow', () => {
  it('shows name, body type, rarity, category and status', () => {
    renderRow()
    expect(screen.getByText('Pirate Hat')).toBeInTheDocument()
    expect(screen.getByTestId('item-row-body-type')).toHaveTextContent('Female')
    expect(screen.getByTestId('item-row-rarity')).toHaveTextContent(/legendary/i)
    expect(screen.getByTestId('item-row-category')).toHaveTextContent('Upper Body')
    expect(screen.getByTestId('item-row-status')).toHaveTextContent(/published/i)
  })

  it('links the name to the item detail route and resolves the thumbnail through storage', () => {
    renderRow()
    expect(screen.getByRole('link', { name: 'Pirate Hat' })).toHaveAttribute('href', '/collections/c1/items/i1')
    const img = screen.getByTestId('item-row').querySelector('img')
    expect(img?.src).toContain('/storage/contents/Qmthumb')
  })

  it('shows draft status and placeholders for missing fields', () => {
    renderRow({
      isPublished: false,
      isApproved: false,
      rarity: undefined,
      data: { representations: [] }
    })
    expect(screen.getByTestId('item-row-status')).toHaveTextContent(/draft/i)
    expect(screen.getByTestId('item-row-body-type')).toHaveTextContent('—')
    expect(screen.getByTestId('item-row-category')).toHaveTextContent('—')
    expect(screen.getByTestId('item-row-rarity')).toBeEmptyDOMElement()
  })
})
