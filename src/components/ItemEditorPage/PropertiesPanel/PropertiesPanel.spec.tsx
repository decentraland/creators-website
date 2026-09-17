import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BodyShape } from '@dcl/schemas'
import { Providers } from '~/components/CollectionDetailPage/SellItemFlow/testUtils'
import { ItemType, type Item } from '~/lib/items'
import { useItemForm } from '../useItemForm'
import { PropertiesPanel } from './PropertiesPanel'

const item: Item = {
  id: 'w1',
  name: 'Hat',
  description: 'A hat',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  collectionId: 'c1',
  rarity: 'epic',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: {
    category: 'hat',
    hides: ['hair'],
    replaces: ['helmet'],
    tags: ['cool'],
    representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] }]
  },
  contents: { 'male/hat.glb': 'bafyglb', 'thumbnail.png': 'bafythumb' },
  createdAt: 1,
  updatedAt: 1
}
const noSpringBones = { isLoading: false, models: [], initialParams: {}, bonesByHash: {} }

function Harness({ editable = true, onSave = vi.fn() }: { editable?: boolean; onSave?: () => void }) {
  const form = useItemForm(item, noSpringBones)
  return (
    <PropertiesPanel
      item={item}
      address="0xabc"
      editable={editable}
      canDelete={editable}
      draft={form.draft}
      dispatch={form.dispatch}
      isDirty={form.isDirty}
      isSaving={false}
      springBones={null}
      onSave={onSave}
      onRevert={() => form.reset(item)}
      onDeleted={vi.fn()}
    />
  )
}

describe('PropertiesPanel', () => {
  it('starts clean with the item values and shows Save/Revert only once something changes', async () => {
    render(<Harness />, { wrapper: Providers })
    expect(screen.getByTestId('properties-panel-name')).toHaveValue('Hat')
    expect(screen.queryByTestId('properties-panel-footer')).not.toBeInTheDocument()
    await userEvent.type(screen.getByTestId('properties-panel-name'), ' 2')
    expect(screen.getByTestId('properties-panel-save')).toBeEnabled()
    await userEvent.click(screen.getByTestId('properties-panel-revert'))
    expect(screen.getByTestId('properties-panel-name')).toHaveValue('Hat')
    expect(screen.queryByTestId('properties-panel-footer')).not.toBeInTheDocument()
  })

  it('folds legacy replaces into the hidden categories and clears them for a skin', async () => {
    render(<Harness />, { wrapper: Providers })
    expect(screen.getByTestId('properties-panel-hides-categories')).toHaveTextContent('Hair, Helmet')
    await userEvent.click(screen.getByTestId('properties-panel-category'))
    await userEvent.click(screen.getByTestId('properties-panel-category-option-skin'))
    expect(screen.getByTestId('properties-panel-hides-categories')).toHaveTextContent('None')
  })

  it('keeps the file and delete actions in the header menu', async () => {
    render(<Harness />, { wrapper: Providers })
    expect(screen.getByTestId('properties-panel-header')).toHaveTextContent('Hat')
    await userEvent.click(screen.getByTestId('properties-panel-actions'))
    expect(screen.getByTestId('properties-panel-download')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel-change-file')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel-add-representation')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel-delete')).toBeInTheDocument()
  })

  it('exposes the wearable options as switches', async () => {
    render(<Harness />, { wrapper: Providers })
    const vrm = screen.getByTestId('properties-panel-vrm-export')
    expect(vrm).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(vrm)
    expect(vrm).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('properties-panel-save')).toBeEnabled()
  })

  it('keeps a name without characters from being saved', async () => {
    render(<Harness />, { wrapper: Providers })
    await userEvent.clear(screen.getByTestId('properties-panel-name'))
    expect(screen.getByTestId('properties-panel-save')).toBeDisabled()
    await userEvent.type(screen.getByTestId('properties-panel-name'), 'a:b')
    expect(screen.getByTestId('properties-panel-name-error')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel-save')).toBeDisabled()
  })

  it('locks every control and hides the footer when not editable', () => {
    render(<Harness editable={false} />, { wrapper: Providers })
    expect(screen.getByTestId('properties-panel-readonly')).toBeInTheDocument()
    expect(screen.getByTestId('properties-panel-name')).toBeDisabled()
    expect(screen.getByTestId('properties-panel-hides-categories')).toBeDisabled()
    expect(screen.queryByTestId('properties-panel-footer')).not.toBeInTheDocument()
  })

  it('adds and removes tags', async () => {
    render(<Harness />, { wrapper: Providers })
    await userEvent.type(screen.getByTestId('tags-input-field'), 'pirate{enter}')
    expect(screen.getAllByTestId('tags-input-tag').map(tag => tag.textContent)).toEqual(['cool', 'pirate'])
    await userEvent.click(screen.getByTestId('tags-input-remove-cool'))
    expect(screen.getAllByTestId('tags-input-tag')).toHaveLength(1)
  })
})
