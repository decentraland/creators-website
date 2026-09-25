import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TranslationProvider } from '~/intl'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { CurationRow } from './CurationRow'

vi.mock('~/components/CollectionMosaic', () => ({ CollectionMosaic: () => null }))
vi.mock('~/hooks/useProfile', () => ({ useProfile: () => ({ data: undefined }) }))

const ME = '0xme00000000000000000000000000000000000001'
const collection = {
  id: 'c1',
  name: 'Hats',
  owner: '0xowner0000000000000000000000000000000001',
  isPublished: true,
  isApproved: false,
  itemCount: 3,
  reviewedAt: 1,
  createdAt: 1,
  updatedAt: 1
} as Collection
const pending: CollectionCuration = {
  id: 'r1',
  collectionId: 'c1',
  status: 'pending',
  assignee: null,
  createdAt: 1,
  updatedAt: 2
}

function renderRow(curation: CollectionCuration | null, subject: Collection = collection) {
  const onAssign = vi.fn()
  render(
    <TranslationProvider>
      <MemoryRouter>
        <CurationRow collection={subject} curation={curation} address={ME} onAssign={onAssign} />
      </MemoryRouter>
    </TranslationProvider>
  )
  return onAssign
}

describe('CurationRow', () => {
  it('opens the collection in the editor in review mode', () => {
    renderRow(null)
    expect(screen.getByTestId('curation-row-link')).toHaveAttribute(
      'href',
      '/collections/editor?collection=c1&reviewing=true'
    )
  })

  it('offers "Assign to me" on an unassigned collection', () => {
    const onAssign = renderRow(null)
    expect(screen.getByTestId('curation-state')).toHaveAttribute('data-state', 'to_review')
    fireEvent.click(screen.getByTestId('curation-row-assign-me'))
    expect(onAssign).toHaveBeenCalledWith(collection, null, 'self')
  })

  it('shows the assigned curator, marked when it is the signed-in one, with an edit button', () => {
    const assigned = { ...pending, assignee: ME }
    const onAssign = renderRow(assigned)
    expect(screen.getByTestId('curation-state')).toHaveAttribute('data-state', 'under_review')
    expect(screen.getByTestId('curation-row-curator')).toHaveTextContent('(you)')
    fireEvent.click(screen.getByTestId('curation-row-edit-assignee'))
    expect(onAssign).toHaveBeenCalledWith(collection, assigned, 'edit')
  })

  it('locks the curator once the collection and its request are approved', () => {
    renderRow({ ...pending, status: 'approved', assignee: ME }, { ...collection, isApproved: true })
    expect(screen.queryByTestId('curation-row-edit-assignee')).toBeNull()
  })
})
