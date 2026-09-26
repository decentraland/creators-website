import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { ItemSyncStatus } from '~/lib/itemSync'
import { ReviewBar } from './ReviewBar'

const state = vi.hoisted(() => ({
  curation: null as CollectionCuration | null,
  syncs: new Map<string, { status: string; entity?: object }>(),
  reject: vi.fn(),
  disable: vi.fn()
}))
vi.mock('~/hooks/useCuration', () => ({
  useCollectionCuration: () => ({ data: state.curation, isLoading: false }),
  useRejectCuration: () => ({ mutate: state.reject, isPending: false, isError: false, reset: vi.fn() }),
  useDisableCollection: () => ({ mutate: state.disable, isPending: false, isError: false, reset: vi.fn() })
}))
vi.mock('~/hooks/useItemSync', () => ({ useItemSyncs: () => state.syncs }))
vi.mock('~/hooks/useProfile', () => ({ useProfile: () => ({ data: undefined }) }))
vi.mock('./ApprovalFlowModal', () => ({
  ApprovalFlowModal: ({ mode }: { mode: string }) => <div data-testid="approval-flow" data-mode={mode} />
}))
vi.mock('~/components/AssignCuratorModal', () => ({
  AssignCuratorModal: ({ mode }: { mode: string }) => <div data-testid="assign-modal" data-mode={mode} />
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

function renderBar(collection: Collection = base) {
  render(
    <TranslationProvider>
      <MemoryRouter>
        <ReviewBar session={session} collection={collection} items={[]} />
      </MemoryRouter>
    </TranslationProvider>
  )
}

const actions = () => screen.queryAllByTestId(/^review-action-/).map(button => button.dataset.testid)

beforeEach(() => {
  state.curation = null
  state.syncs = new Map()
  state.reject.mockReset()
  state.disable.mockReset()
})

describe('ReviewBar', () => {
  it('offers approve and reject on a new collection and opens the approval flow', () => {
    renderBar()
    expect(actions()).toEqual(['review-action-approve', 'review-action-reject'])
    fireEvent.click(screen.getByTestId('review-action-approve'))
    expect(screen.getByTestId('approval-flow')).toHaveAttribute('data-mode', 'approve')
  })

  it('rejects after confirming', () => {
    renderBar()
    fireEvent.click(screen.getByTestId('review-action-reject'))
    fireEvent.click(screen.getByTestId('review-reject-confirm'))
    expect(state.reject).toHaveBeenCalledWith({ collection: base, curation: null }, expect.anything())
  })

  it('disables an approved collection after confirming, and offers the missing entities deploy', () => {
    state.syncs = new Map([['i1', { status: ItemSyncStatus.UNSYNCED }]])
    const approved = { ...base, isApproved: true }
    renderBar(approved)
    expect(actions()).toEqual(['review-action-disable', 'review-action-deploy_missing'])
    fireEvent.click(screen.getByTestId('review-action-disable'))
    fireEvent.click(screen.getByTestId('review-disable-confirm'))
    expect(state.disable).toHaveBeenCalledWith(approved, expect.anything())
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
})
