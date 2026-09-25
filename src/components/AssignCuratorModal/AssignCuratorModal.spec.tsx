import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { AssignCuratorModal } from './AssignCuratorModal'

const ME = '0xme'
const OTHER = '0xother'
const mutate = vi.fn()
vi.mock('~/hooks/useCuration', () => ({
  useCommittee: () => ({ members: [OTHER, ME], isCurator: true, isLoading: false }),
  useAssignCurator: () => ({ mutate, isPending: false, isError: false })
}))
vi.mock('~/hooks/useProfile', () => ({ useProfiles: (list: string[]) => list.map(() => undefined) }))

const collection = { id: 'c1', name: 'Hats' } as Collection
const curation: CollectionCuration = {
  id: 'r1',
  collectionId: 'c1',
  status: 'pending',
  assignee: OTHER,
  createdAt: 1,
  updatedAt: 1
}

function renderModal(mode: 'self' | 'edit', onClose = vi.fn()) {
  render(
    <TranslationProvider>
      <AssignCuratorModal collection={collection} curation={curation} address={ME} mode={mode} onClose={onClose} />
    </TranslationProvider>
  )
  return onClose
}

beforeEach(() => mutate.mockReset())

describe('AssignCuratorModal', () => {
  it('assigns the signed-in curator', () => {
    renderModal('self')
    fireEvent.click(screen.getByTestId('assign-curator-submit'))
    expect(mutate).toHaveBeenCalledWith({ collection, curation, assignee: ME }, expect.anything())
  })

  it('unassigns the collection', () => {
    renderModal('edit')
    fireEvent.click(screen.getByTestId('assign-curator-select'))
    fireEvent.click(screen.getByRole('option', { name: 'Nobody (unassign)' }))
    fireEvent.click(screen.getByTestId('assign-curator-submit'))
    expect(mutate).toHaveBeenCalledWith({ collection, curation, assignee: null }, expect.anything())
  })

  it('closes without a request when the curator did not change', () => {
    const onClose = renderModal('edit')
    fireEvent.click(screen.getByTestId('assign-curator-submit'))
    expect(mutate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
