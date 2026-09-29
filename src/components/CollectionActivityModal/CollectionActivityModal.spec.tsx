import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type Collection } from '~/lib/collections'
import { type CollectionEvent } from '~/lib/events'
import { CollectionActivityModal } from './CollectionActivityModal'

const state = vi.hoisted(() => ({
  events: [] as CollectionEvent[],
  isLoading: false,
  isError: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  isCurator: false
}))
vi.mock('~/hooks/useCollectionEvents', () => ({
  useCollectionEvents: () => ({
    events: state.events,
    isLoading: state.isLoading,
    isError: state.isError,
    error: null,
    hasNextPage: state.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: state.fetchNextPage,
    refetch: vi.fn()
  })
}))
vi.mock('~/hooks/useCuration', () => ({ useCommittee: () => ({ isCurator: state.isCurator }) }))
vi.mock('~/hooks/useProfile', () => ({ useProfile: () => ({ data: { name: 'Curator Jane' } }) }))
vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))

const collection = { id: 'c1', name: 'Hats', isPublished: true } as Collection

let counter = 0
function event(
  type: string,
  actor: CollectionEvent['actor'],
  payload: CollectionEvent['payload'] = {}
): CollectionEvent {
  return {
    id: `e${++counter}`,
    collectionId: 'c1',
    type,
    actor,
    actorAddress: actor === 'creator' || actor === 'curator' ? '0xabc' : null,
    payload,
    createdAt: Date.now() - counter * 60_000
  }
}

function renderModal() {
  render(
    <TranslationProvider>
      <CollectionActivityModal collection={collection} address="0xme" onClose={vi.fn()} />
    </TranslationProvider>
  )
}

beforeEach(() => {
  state.events = []
  state.isLoading = false
  state.isError = false
  state.hasNextPage = false
  state.isCurator = false
  state.fetchNextPage.mockReset()
})

describe('CollectionActivityModal', () => {
  it('renders one readable row per event with its details', () => {
    state.events = [
      event('review.rejected', 'curator', { rejectionReasons: ['clipping'], rejectionMessage: 'Fix the sleeves' }),
      event('review.appeal_requested', 'creator', { note: 'I fixed it' }),
      event('review.ai_rejected', 'validator', {
        verdict: 'rejected',
        items: [
          {
            itemId: 'i1',
            contentHash: 'h',
            passed: false,
            findings: [{ rule: 'M-01', severity: 'error', message: 'Too many' }]
          }
        ]
      }),
      event('review.assigned', 'curator', { assignee: '0xabc' }),
      event('review.ai_started', 'validator', { trigger: 'retry' }),
      event('collection.published', 'creator', { txHash: '0x1' })
    ]
    renderModal()
    const lines = screen.getAllByTestId('activity-line').map(line => line.textContent)
    expect(lines).toEqual([
      'rejected the collection',
      'requested a human review',
      'Automatic review found issues in 1 item',
      'assigned the review to Curator Jane',
      'Automatic review started (requested by the creator)',
      'published the collection'
    ])
    expect(screen.getByTestId('activity-reasons')).toHaveTextContent('Clipping')
    expect(screen.getAllByTestId('activity-quote').map(quote => quote.textContent)).toEqual([
      'Fix the sleeves',
      'I fixed it'
    ])
    fireEvent.click(screen.getByTestId('activity-toggle-findings'))
    expect(screen.getByTestId('activity-findings-i1-finding')).toHaveTextContent('M-01')
  })

  it('shows the validation id only when the server sent it, and softens errors for creators', () => {
    state.events = [event('review.ai_error', 'validator', { validationId: 'val-9', verdict: 'error', items: [] })]
    renderModal()
    expect(screen.getByTestId('activity-validation-id')).toHaveTextContent('val-9')
    expect(screen.getByTestId('activity-line')).toHaveTextContent('Automatic review restarted')
  })

  it('tells curators about validator failures', () => {
    state.isCurator = true
    state.events = [event('review.ai_error', 'validator', { verdict: 'error', items: [] })]
    renderModal()
    expect(screen.getByTestId('activity-line')).toHaveTextContent('failed and will be retried')
    expect(screen.queryByTestId('activity-validation-id')).toBeNull()
  })

  it('loads the next page on demand and shows the empty and error states', () => {
    state.events = [event('collection.published', 'creator')]
    state.hasNextPage = true
    const { unmount } = render(
      <TranslationProvider>
        <CollectionActivityModal collection={collection} address="0xme" onClose={vi.fn()} />
      </TranslationProvider>
    )
    fireEvent.click(screen.getByTestId('activity-load-more'))
    expect(state.fetchNextPage).toHaveBeenCalled()
    unmount()

    state.events = []
    state.hasNextPage = false
    renderModal()
    expect(screen.getByTestId('activity-empty')).toBeInTheDocument()
  })
})
