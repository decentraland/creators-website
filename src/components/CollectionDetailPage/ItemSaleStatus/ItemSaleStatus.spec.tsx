import { describe, it, expect } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type ItemListing } from '~/lib/listings'
import { ItemSaleStatus } from './ItemSaleStatus'

const listing: ItemListing = { itemId: '3', currency: 'mana', manaWei: 10n }

function renderStatus(props: Parameters<typeof ItemSaleStatus>[0]) {
  const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>
  return render(<ItemSaleStatus {...props} />, { wrapper })
}

describe('ItemSaleStatus', () => {
  it('offers to put an item on sale when it has no listing', () => {
    renderStatus({ sales: { minted: 3, maxSupply: 100 }, listing: null })
    expect(screen.getByRole('button', { name: /put on sale/i })).toBeInTheDocument()
  })

  it('shows the item is on sale when it has a listing', () => {
    renderStatus({ sales: { minted: 3, maxSupply: 100 }, listing })
    expect(screen.getByTestId('item-sale-status')).toHaveTextContent(/on sale/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows sold out once the whole supply is minted, even without a listing', () => {
    renderStatus({ sales: { minted: 100, maxSupply: 100 }, listing: null })
    expect(screen.getByTestId('item-sale-status')).toHaveTextContent(/sold out/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing while listings are still loading', () => {
    renderStatus({ sales: { minted: 3, maxSupply: 100 }, listing: undefined })
    expect(screen.queryByTestId('item-sale-status')).not.toBeInTheDocument()
  })
})
