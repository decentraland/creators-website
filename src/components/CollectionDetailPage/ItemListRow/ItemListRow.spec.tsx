import { describe, it, expect } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
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
  const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>
  return render(<ItemListRow item={{ ...item, ...overrides }} />, { wrapper })
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
})
