import { describe, it, expect } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { type Collection } from '~/lib/collections'
import { CollectionStatusPill } from './CollectionStatusPill'

const underReview: Collection = {
  id: 'c1',
  name: 'Pirate Hats',
  owner: '0xabc',
  urn: 'urn:decentraland:amoy:collections-v2:0xcontract',
  contractAddress: '0xcontract',
  isPublished: true,
  isApproved: false,
  itemCount: 2,
  minters: [],
  managers: [],
  createdAt: 1000,
  updatedAt: 1000
}

const published: Collection = { ...underReview, isApproved: true }

function renderPill(props: Parameters<typeof CollectionStatusPill>[0]) {
  const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>
  return render(<CollectionStatusPill {...props} />, { wrapper })
}

describe('CollectionStatusPill', () => {
  it('explains the review when hovering an under-review pill with the hint enabled', async () => {
    renderPill({ collection: underReview, reviewHint: true })
    expect(screen.getByTestId('collection-status')).toHaveAttribute('data-status', 'under_review')

    await userEvent.hover(screen.getByTestId('collection-status-hint-trigger'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/up to 5 minutes/i)
  })

  it('shows no hint on the collections list (hint disabled)', () => {
    renderPill({ collection: underReview })
    expect(screen.queryByTestId('collection-status-hint-trigger')).not.toBeInTheDocument()
  })

  it('shows no hint for other statuses even when enabled', () => {
    renderPill({ collection: published, reviewHint: true })
    expect(screen.getByTestId('collection-status')).toHaveAttribute('data-status', 'published')
    expect(screen.queryByTestId('collection-status-hint-trigger')).not.toBeInTheDocument()
  })
})
