import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { ApprovalFlowModal } from './ApprovalFlowModal'

const state = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  assign: vi.fn(),
  assignError: false
}))
vi.mock('~/hooks/useApprovalFlow', () => ({
  useApprovalFlow: () => ({ view: { kind: 'approve', busy: false }, start: state.start, stop: state.stop })
}))
vi.mock('~/hooks/useCuration', () => ({
  useAssignCurator: () => ({ mutate: state.assign, isPending: false, isError: state.assignError })
}))
vi.mock('~/hooks/useProfile', () => ({ useProfile: () => ({ data: { name: 'Ana' } }) }))

const session = { address: '0xMe' } as Session
const collection = { id: 'c1', name: 'Hats' } as Collection
const request = (assignee: string | null) =>
  ({ id: 'r1', collectionId: 'c1', status: 'pending', assignee, createdAt: 1, updatedAt: 1 }) as CollectionCuration

function renderModal(curation: CollectionCuration | null) {
  render(
    <TranslationProvider>
      <ApprovalFlowModal
        session={session}
        collection={collection}
        curation={curation}
        mode="approve"
        onClose={vi.fn()}
      />
    </TranslationProvider>
  )
}

beforeEach(() => {
  state.start.mockReset()
  state.assign.mockReset()
  state.assignError = false
})

describe('ApprovalFlowModal', () => {
  it('starts right away when the collection is the curator’s or nobody’s', () => {
    renderModal(request('0xme'))
    expect(state.start).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('approval-approve')).toBeInTheDocument()
  })

  it('takes over another curator’s collection before starting', () => {
    state.assign.mockImplementation((_vars, { onSuccess }) => onSuccess(request('0xme')))
    renderModal(request('0xother'))
    expect(state.start).not.toHaveBeenCalled()
    expect(screen.getByText(/assigned to Ana/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('approval-assign-confirm'))
    expect(state.assign).toHaveBeenCalledWith(
      { collection, curation: request('0xother'), assignee: '0xme' },
      expect.anything()
    )
    expect(state.start).toHaveBeenCalledTimes(1)
  })

  it('tells the curator when taking over the collection failed', () => {
    state.assignError = true
    renderModal(request('0xother'))
    expect(screen.getByTestId('approval-assign-error')).toBeInTheDocument()
  })
})
