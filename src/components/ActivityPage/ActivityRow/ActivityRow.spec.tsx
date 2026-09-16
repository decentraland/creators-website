import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '~/intl'
import { type ActivityEvent } from '~/lib/activity'
import { openExternal } from '~/lib/navigation'
import { ActivityRow } from './ActivityRow'

vi.mock('~/lib/navigation', () => ({ openExternal: vi.fn() }))

const base: ActivityEvent = {
  id: 'evt-1',
  type: 'send_items',
  txHash: '0xhash',
  chainId: 80002,
  status: 'confirmed',
  timestamp: Date.now() - 3 * 60_000,
  collectionId: 'col-1',
  collectionName: 'Hats',
  itemName: 'Beret',
  count: 3
}

function renderRow(event: ActivityEvent) {
  return render(
    <TranslationProvider>
      <MemoryRouter>
        <ul>
          <ActivityRow event={event} />
        </ul>
      </MemoryRouter>
    </TranslationProvider>
  )
}

describe('ActivityRow', () => {
  it('says what was done, links the collection and shows when and how it ended', () => {
    renderRow(base)
    expect(screen.getByTestId('activity-text')).toHaveTextContent('Sent 3 items from Hats')
    expect(screen.getByTestId('activity-collection-link')).toHaveAttribute('href', '/collections/col-1')
    expect(screen.getByTestId('activity-status')).toHaveTextContent('Confirmed')
    expect(screen.getByText('3 minutes ago')).toBeInTheDocument()
  })

  it('opens the transaction in the block explorer of its chain', () => {
    renderRow(base)
    fireEvent.click(screen.getByTestId('activity-explorer'))
    expect(openExternal).toHaveBeenCalledWith('https://amoy.polygonscan.com/tx/0xhash')
  })

  it('shows a mining transaction as pending and a reverted one as failed', () => {
    const { unmount } = renderRow({ ...base, status: 'pending' })
    expect(screen.getByTestId('activity-row')).toHaveAttribute('data-status', 'pending')
    expect(screen.getByTestId('activity-status')).toHaveTextContent('Pending')
    unmount()
    renderRow({ ...base, status: 'reverted' })
    expect(screen.getByTestId('activity-status')).toHaveTextContent('Failed')
  })

  it('has no collection link for a wallet-level transaction', () => {
    renderRow({ id: 'evt-2', type: 'approve_mana', txHash: '0x2', chainId: 80002, status: 'confirmed', timestamp: 1 })
    expect(screen.getByTestId('activity-text')).toHaveTextContent('Approved MANA for publishing')
    expect(screen.queryByTestId('activity-collection-link')).toBeNull()
  })
})
