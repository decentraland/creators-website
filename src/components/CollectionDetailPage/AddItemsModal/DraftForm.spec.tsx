import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { TranslationProvider } from '~/intl'
import { BodyShapeType, ItemType, type Item } from '~/lib/items'
import { createDraft, type ItemDraft } from './AddItemsModal.state'
import { DraftForm } from './DraftForm'

vi.mock('~/hooks/useThumbnailValidation', () => ({ useThumbnailValidation: () => ({ data: undefined }) }))

const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>

function renderForm(patch: Partial<ItemDraft>, extra: Partial<Parameters<typeof DraftForm>[0]> = {}) {
  const draft: ItemDraft = {
    ...createDraft(new File([''], 'jacket.glb')),
    status: 'ready',
    type: ItemType.WEARABLE,
    category: 'upper_body',
    bodyShape: BodyShapeType.MALE,
    thumbnail: 'data:image/png;base64,AAAA',
    ...patch
  }
  const onOpenThumbnail = vi.fn()
  render(
    <DraftForm
      draft={draft}
      drafts={[draft]}
      collectionItems={[]}
      onUpdate={vi.fn()}
      onOpenThumbnail={onOpenThumbnail}
      onOpenVideo={vi.fn()}
      onVideoChange={vi.fn()}
      {...extra}
    />,
    { wrapper }
  )
  return { onOpenThumbnail }
}

describe('DraftForm thumbnail', () => {
  it('opens the thumbnail editor for a regular item', async () => {
    const { onOpenThumbnail } = renderForm({ isVariant: false })
    await userEvent.click(screen.getByTestId('edit-thumbnail'))
    expect(onOpenThumbnail).toHaveBeenCalled()
  })

  it('only previews the thumbnail of a body shape variant, since its target keeps its own', () => {
    renderForm({ isVariant: true })
    expect(screen.getByTestId('draft-thumbnail')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-thumbnail')).not.toBeInTheDocument()
  })
})

describe('DraftForm in edit in bulk', () => {
  it('names the item the zip updates, with its URN identifier', () => {
    const urn = 'urn:decentraland:amoy:collections-thirdparty:brand:hats:gold-hat'
    renderForm(
      { urnSuffix: 'gold-hat' },
      {
        linked: { contract: null, updating: true },
        collectionItems: [{ id: 'i1', name: 'Gold Hat', urn } as Item]
      }
    )
    expect(screen.getByTestId('bulk-edit-target')).toHaveTextContent('Updates Gold Hat (gold-hat)')
    expect(screen.getByTestId('bulk-edit-target')).toHaveAttribute('title', urn)
  })
})
