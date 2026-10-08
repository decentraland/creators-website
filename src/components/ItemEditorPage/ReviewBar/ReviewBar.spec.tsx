import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { openExternal } from '~/lib/navigation'
import { ValidationSeverity, type ValidationIssue } from '~/lib/validation'
import { type CollectionCuration } from '~/lib/curation'
import { ItemSyncStatus } from '~/lib/itemSync'
import { ReviewBar } from './ReviewBar'

const state = vi.hoisted(() => ({
  curation: null as CollectionCuration | null,
  curationError: false,
  curationLoading: false,
  refetch: vi.fn(),
  syncs: new Map<string, { status: string; entity?: object }>(),
  reject: vi.fn(),
  disable: vi.fn(),
  issues: new Map<string, ValidationIssue[]>(),
  isValidating: false,
  selectItem: vi.fn()
}))
vi.mock('~/lib/navigation', () => ({ openExternal: vi.fn() }))
vi.mock('~/hooks/useCuration', () => ({
  useCollectionCuration: () => ({
    data: state.curation,
    isLoading: state.curationLoading,
    isError: state.curationError,
    refetch: state.refetch
  }),
  useRejectCuration: () => ({ mutate: state.reject, isPending: false, isError: false, reset: vi.fn() }),
  useDisableCollection: () => ({ mutate: state.disable, isPending: false, isError: false, reset: vi.fn() })
}))
vi.mock('~/hooks/useItemSync', () => ({ useItemSyncs: () => state.syncs }))
// Checks exactly the items it is handed, like the real hook, with canned results.
vi.mock('~/hooks/useCollectionValidation', () => ({
  useCollectionValidation: (items: Item[], enabled: boolean) => ({
    results: new Map(
      (enabled ? items : []).map(item => [item.id, { status: 'pass', issues: state.issues.get(item.id) ?? [] }])
    ),
    isValidating: enabled && state.isValidating
  })
}))
vi.mock('~/hooks/useProfile', () => ({ useProfile: () => ({ data: undefined }) }))
vi.mock('./ApprovalFlowModal', () => ({
  ApprovalFlowModal: ({ mode }: { mode: string }) => <div data-testid="approval-flow" data-mode={mode} />
}))
vi.mock('~/components/AssignCuratorModal', () => ({
  AssignCuratorModal: ({ mode, onAssigned }: { mode: string; onAssigned?: () => void }) => (
    <div data-testid="assign-modal" data-mode={mode}>
      {onAssigned && <button type="button" data-testid="assign-continue" onClick={onAssigned} />}
    </div>
  )
}))

const session = { address: '0xme' } as Session
const base = {
  id: 'c1',
  name: 'Hats',
  isPublished: true,
  isApproved: false,
  reviewedAt: 1,
  createdAt: 1
} as Collection

const item = (id: string) =>
  ({
    id,
    name: `Item ${id}`,
    type: 'wearable',
    contents: {},
    thumbnail: '',
    data: { category: 'hat' }
  }) as unknown as Item
const items = [item('i1'), item('i2'), item('i3')]
const error = (message: string): ValidationIssue => ({ code: 'c', severity: ValidationSeverity.ERROR, message })
const warning = (message: string): ValidationIssue => ({ code: 'c', severity: ValidationSeverity.WARNING, message })

function renderBar(collection: Collection = base) {
  render(
    <TranslationProvider>
      <MemoryRouter>
        <ReviewBar session={session} collection={collection} items={items} onSelectItem={state.selectItem} />
      </MemoryRouter>
    </TranslationProvider>
  )
}

const actions = () => screen.queryAllByTestId(/^review-action-/).map(button => button.dataset.testid)

beforeEach(() => {
  state.curation = null
  state.curationError = false
  state.curationLoading = false
  state.syncs = new Map()
  state.reject.mockReset()
  state.disable.mockReset()
  state.issues = new Map()
  state.isValidating = false
  state.selectItem.mockReset()
})

describe('ReviewBar', () => {
  it('offers approve and reject on a new collection, assigning it to the curator before the approval flow', () => {
    renderBar()
    expect(actions()).toEqual(['review-action-approve', 'review-action-reject'])
    fireEvent.click(screen.getByTestId('review-action-approve'))
    expect(screen.getByTestId('assign-modal')).toHaveAttribute('data-mode', 'self')
    expect(screen.queryByTestId('approval-flow')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('assign-continue'))
    expect(screen.getByTestId('approval-flow')).toHaveAttribute('data-mode', 'approve')
  })

  it('takes over another curator’s collection before deciding on it', () => {
    state.curation = { status: 'pending', assignee: '0xother', createdAt: 1, updatedAt: 1 } as CollectionCuration
    renderBar()
    fireEvent.click(screen.getByTestId('review-action-reject'))
    fireEvent.click(screen.getByTestId('assign-continue'))
    expect(screen.getByTestId('review-reject')).toBeInTheDocument()
  })

  it('goes straight to the decision when the collection is already the curator’s', () => {
    state.curation = { status: 'pending', assignee: '0xme', createdAt: 1, updatedAt: 1 } as CollectionCuration
    renderBar()
    fireEvent.click(screen.getByTestId('review-action-approve'))
    expect(screen.queryByTestId('assign-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-flow')).toBeInTheDocument()
  })

  it('enables a disabled collection without opening a request up front', () => {
    renderBar({ ...base, reviewedAt: 5 })
    fireEvent.click(screen.getByTestId('review-action-enable'))
    expect(screen.queryByTestId('assign-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-flow')).toHaveAttribute('data-mode', 'enable')
  })

  it('asks to take over the request of a disabled collection before enabling it', () => {
    state.curation = { status: 'approved', assignee: '0xother', createdAt: 1, updatedAt: 1 } as CollectionCuration
    renderBar({ ...base, reviewedAt: 5 })
    fireEvent.click(screen.getByTestId('review-action-enable'))
    fireEvent.click(screen.getByTestId('assign-continue'))
    expect(screen.getByTestId('approval-flow')).toHaveAttribute('data-mode', 'enable')
  })

  it('rejects after confirming', () => {
    renderBar()
    fireEvent.click(screen.getByTestId('review-action-reject'))
    fireEvent.click(screen.getByTestId('assign-continue'))
    fireEvent.click(screen.getByTestId('review-reject-confirm'))
    expect(state.reject).toHaveBeenCalledWith({ collection: base, curation: null }, expect.anything())
  })

  it('points the curator to the forum post to explain a rejection', () => {
    state.reject.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess())
    renderBar({ ...base, forumLink: 'https://forum.decentraland.org/t/hats/77' })
    fireEvent.click(screen.getByTestId('review-action-reject'))
    fireEvent.click(screen.getByTestId('assign-continue'))
    fireEvent.click(screen.getByTestId('review-reject-confirm'))
    fireEvent.click(screen.getByTestId('review-verdict-forum-link'))
    expect(openExternal).toHaveBeenCalledWith('https://forum.decentraland.org/t/hats/77')
  })

  it('just confirms a rejection when the collection has no forum post', () => {
    state.reject.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess())
    renderBar()
    fireEvent.click(screen.getByTestId('review-action-reject'))
    fireEvent.click(screen.getByTestId('assign-continue'))
    fireEvent.click(screen.getByTestId('review-reject-confirm'))
    expect(screen.queryByTestId('review-verdict')).not.toBeInTheDocument()
  })

  it('disables an approved collection after confirming, and offers the missing entities deploy', () => {
    state.syncs = new Map([['i1', { status: ItemSyncStatus.UNSYNCED }]])
    const approved = { ...base, isApproved: true }
    renderBar(approved)
    expect(actions()).toEqual(['review-action-disable', 'review-action-deploy_missing'])
    fireEvent.click(screen.getByTestId('review-action-disable'))
    fireEvent.click(screen.getByTestId('review-disable-confirm'))
    expect(state.disable).toHaveBeenCalledWith(expect.objectContaining({ collection: approved }), expect.anything())
  })

  it('offers only enable on a disabled collection', () => {
    renderBar({ ...base, reviewedAt: 5 })
    expect(actions()).toEqual(['review-action-enable'])
  })

  it('has no actions on an unpublished collection', () => {
    renderBar({ ...base, isPublished: false })
    expect(actions()).toEqual([])
    expect(screen.getByTestId('review-unpublished')).toBeInTheDocument()
  })

  it('assigns the collection from the bar', () => {
    renderBar()
    fireEvent.click(screen.getByTestId('review-assign-me'))
    expect(screen.getByTestId('assign-modal')).toHaveAttribute('data-mode', 'self')
  })

  it('dates a rejection by when it happened, not by the request it opened', () => {
    state.curation = { status: 'rejected', assignee: null, createdAt: 1, updatedAt: Date.now() } as CollectionCuration
    renderBar()
    expect(screen.getByTestId('review-requested')).toHaveTextContent(/^Rejected/)
  })

  it('stops offering the assignment once the collection and its request are approved', () => {
    state.curation = { status: 'approved', assignee: null, createdAt: 1, updatedAt: 2 } as CollectionCuration
    renderBar({ ...base, isApproved: true })
    expect(screen.queryByTestId('review-assign-me')).not.toBeInTheDocument()
  })

  it('holds back every action until the review request loads', () => {
    state.curationError = true
    renderBar()
    expect(actions()).toEqual([])
    expect(screen.queryByTestId('review-assign-me')).toBeNull()
    fireEvent.click(screen.getByTestId('review-curation-retry'))
    expect(state.refetch).toHaveBeenCalled()
  })

  it('offers nothing to act on while the review request loads', () => {
    state.curationLoading = true
    renderBar()
    expect(actions()).toEqual([])
    expect(screen.queryByTestId('review-assign-me')).toBeNull()
    expect(screen.queryByTestId('review-assignee')).toBeNull()
  })

  describe('collection validation', () => {
    const pending = (...ids: string[]) =>
      new Map(ids.map(id => [id, { status: ItemSyncStatus.UNDER_REVIEW }] as [string, { status: string }]))

    it('lists every item with issues in one modal and opens the one picked', () => {
      state.syncs = pending('i1', 'i2', 'i3')
      state.issues = new Map([
        ['i1', [error('Too many triangles')]],
        ['i3', [warning('Big texture'), error('No skeleton')]]
      ])
      renderBar()
      const badge = screen.getByTestId('review-validation')
      expect(badge).toHaveAttribute('data-status', 'errors')
      expect(badge).toHaveTextContent('3 issues')

      fireEvent.click(badge)
      expect(screen.getByTestId('review-validation-i1-card')).toHaveTextContent('Too many triangles')
      expect(screen.getByTestId('review-validation-i3-card')).toHaveTextContent('No skeleton')
      expect(screen.queryByTestId('review-validation-i2-card')).toBeNull()

      fireEvent.click(screen.getByTestId('review-validation-i3-select'))
      expect(state.selectItem).toHaveBeenCalledWith(items[2])
    })

    it('shows a spinner while any item is being checked', () => {
      state.syncs = pending('i1')
      state.isValidating = true
      renderBar()
      expect(screen.getByTestId('review-validation')).toHaveAttribute('data-status', 'loading')
    })

    it('turns green with no modal when every item passes', () => {
      state.syncs = pending('i1', 'i2')
      renderBar()
      const badge = screen.getByTestId('review-validation')
      expect(badge).toHaveAttribute('data-status', 'pass')
      fireEvent.click(badge)
      expect(screen.queryByTestId('review-validation-modal')).toBeNull()
    })

    it('opens warnings-only results too', () => {
      state.syncs = pending('i1')
      state.issues = new Map([['i1', [warning('Big texture')]]])
      renderBar()
      expect(screen.getByTestId('review-validation')).toHaveAttribute('data-status', 'warnings')
      fireEvent.click(screen.getByTestId('review-validation'))
      expect(screen.getByTestId('review-validation-i1-card')).toBeInTheDocument()
    })

    it('checks only the items with changes waiting for approval', () => {
      state.curation = { status: 'pending', assignee: null, createdAt: 1, updatedAt: 1 } as CollectionCuration
      state.syncs = new Map([
        ['i1', { status: ItemSyncStatus.SYNCED }],
        ['i2', { status: ItemSyncStatus.UNDER_REVIEW }]
      ])
      state.issues = new Map([['i1', [error('Old problem')]]])
      renderBar({ ...base, isApproved: true })
      expect(screen.getByTestId('review-validation')).toHaveAttribute('data-status', 'pass')
    })

    it.each([
      ['approved', { ...base, isApproved: true }],
      ['disabled', { ...base, reviewedAt: 5 }],
      ['unpublished', { ...base, isPublished: false }]
    ])('checks nothing on an %s collection', (_, collection) => {
      state.syncs = pending('i1')
      state.issues = new Map([['i1', [error('Too many triangles')]]])
      renderBar(collection)
      expect(screen.queryByTestId('review-validation')).toBeNull()
    })

    it('checks nothing on a rejected collection', () => {
      state.curation = { status: 'rejected', assignee: null, createdAt: 1, updatedAt: 1 } as CollectionCuration
      state.syncs = pending('i1')
      renderBar()
      expect(screen.queryByTestId('review-validation')).toBeNull()
    })
  })
})
