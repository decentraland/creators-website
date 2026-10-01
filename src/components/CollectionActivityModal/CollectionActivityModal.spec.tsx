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
  isFetchNextPageError: false,
  isAvailable: true,
  fetchNextPage: vi.fn(),
  isCurator: false
}))
vi.mock('~/hooks/useCollectionEvents', () => ({
  useCollectionEvents: () => ({
    events: state.events,
    isLoading: state.isLoading,
    isError: state.isError || state.isFetchNextPageError,
    error: null,
    hasNextPage: state.hasNextPage,
    isFetchNextPageError: state.isFetchNextPageError,
    isAvailable: state.isAvailable,
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
  state.isFetchNextPageError = false
  state.isAvailable = true
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
            findings: [{ rule: 'M-01', severity: 'error', message: 'Too many', docs: 'javascript:alert(1)' }]
          },
          { itemId: 'i2', contentHash: 'h2', passed: null, findings: [] }
        ]
      }),
      event('review.assigned', 'curator', { assignee: '0xabc' }),
      event('review.ai_started', 'validator', { trigger: 'retry' }),
      event('collection.published', 'creator')
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
    expect(screen.getByTestId('activity-findings-i1-finding').querySelector('a')).toBeNull()
  })

  it('names an event type it does not know instead of an i18n key', () => {
    state.events = [event('review.something_new', 'system')]
    renderModal()
    expect(screen.getByTestId('activity-line')).toHaveTextContent('review.something_new')
  })

  it('keeps the loaded rows when a later page fails', () => {
    state.events = [event('collection.published', 'creator')]
    state.hasNextPage = true
    state.isFetchNextPageError = true
    renderModal()
    expect(screen.getByTestId('activity-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('activity-load-more-error')).toBeInTheDocument()
    expect(screen.queryByTestId('activity-error')).toBeNull()
  })

  it('shows the validation id only when the server sent it, and softens errors for creators', () => {
    state.events = [event('review.ai_error', 'validator', { validationId: 'val-9', verdict: 'error', items: [] })]
    renderModal()
    expect(screen.getByTestId('activity-validation-id')).toHaveTextContent('val-9')
    expect(screen.getByTestId('activity-line')).toHaveTextContent('Automatic review restarted')
  })

  it('explains items the validator could not check, with their findings and the id for curators', () => {
    state.isCurator = true
    state.events = [
      event('review.human_required', 'system', {
        reason: 'unsupported_items',
        validationId: 'val-3',
        verdict: 'error',
        items: [
          {
            itemId: 'i1',
            contentHash: 'h',
            passed: null,
            findings: [{ rule: 'S-01', severity: 'warning', message: 'PNG facial features need a curator' }]
          }
        ]
      }),
      event('review.human_required', 'system', { reason: 'third_party' })
    ]
    renderModal()
    const lines = screen.getAllByTestId('activity-line').map(line => line.textContent)
    expect(lines[0]).toBe("Some items can't be reviewed automatically, a curator will review them")
    expect(lines[1]).toBe('Sent to the curation committee (third-party collection)')
    expect(screen.getByTestId('activity-validation-id')).toHaveTextContent('val-3')
    fireEvent.click(screen.getByTestId('activity-toggle-findings'))
    expect(screen.getByTestId('activity-findings-i1-finding')).toHaveTextContent('S-01')
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

  it('tells a server without the timeline apart from an empty one', () => {
    state.isAvailable = false
    renderModal()
    expect(screen.getByTestId('activity-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('activity-empty')).toBeNull()
  })
})
