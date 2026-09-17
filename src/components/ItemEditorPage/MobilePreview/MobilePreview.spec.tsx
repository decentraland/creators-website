import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BodyShape } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { ItemType, type Item } from '~/lib/items'
import { MobilePreview } from './MobilePreview'

const make = (id: string, bodyShapes: BodyShape[]): Item => ({
  id,
  name: id,
  description: '',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: { representations: [{ bodyShapes, mainFile: 'm.glb', contents: [] }] },
  contents: {},
  createdAt: 1,
  updatedAt: 1
})
const hat = make('hat', [BodyShape.MALE, BodyShape.FEMALE])
const dress = make('dress', [BodyShape.FEMALE])

describe('MobilePreview', () => {
  it('shows the preview with a thumbnail strip that switches the selection and a dismissible hint', async () => {
    const onSelect = vi.fn()
    render(
      <MobilePreview
        items={[hat, dress]}
        selectedId="hat"
        dressedIds={['hat']}
        bodyShape={BodyShape.MALE}
        onSelect={onSelect}
      >
        <div data-testid="preview" />
      </MobilePreview>,
      { wrapper: TranslationProvider }
    )
    expect(screen.getByTestId('preview')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-strip-item-hat')).toHaveAttribute('data-selected')
    expect(screen.getByTestId('mobile-strip-item-dress')).toHaveAttribute('data-unavailable')
    await userEvent.click(screen.getByTestId('mobile-strip-item-dress'))
    expect(onSelect).toHaveBeenCalledWith(dress)
    await userEvent.click(screen.getByTestId('mobile-hint-dismiss'))
    expect(screen.queryByTestId('mobile-hint')).not.toBeInTheDocument()
  })
})
