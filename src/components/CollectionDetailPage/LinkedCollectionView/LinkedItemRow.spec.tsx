import { describe, it, expect, vi, afterEach } from 'vitest'
import { type ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { type ContractNetwork, type Mappings } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { ItemType, type Item } from '~/lib/items'
import { LinkedItemStatus } from '~/lib/linkedItemStatus'
import { LinkedItemRow } from './LinkedItemRow'

const CONTRACT = { network: 'amoy' as ContractNetwork, address: '0x1d9fb685c257e74f869ba302e260c0b68f5ebb37' }

const item: Item = {
  id: 'i1',
  name: 'Gold Hat',
  description: '',
  thumbnail: 'thumbnail.png',
  owner: '',
  urn: 'urn:decentraland:amoy:collections-thirdparty:brand:hats:gold-hat',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  mappings: { amoy: { [CONTRACT.address]: [{ type: 'single', id: '1' }] } } as Mappings,
  type: ItemType.WEARABLE,
  data: { category: 'hat', representations: [] },
  contents: {},
  createdAt: 1,
  updatedAt: 1
}

const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>

function renderRow(onSaveMappings = vi.fn().mockResolvedValue(item)) {
  const onMappingDirtyChange = vi.fn()
  const view = render(
    <LinkedItemRow
      item={item}
      contract={CONTRACT}
      status={LinkedItemStatus.READY_TO_PUBLISH}
      selectable
      selected={false}
      onSelectedChange={vi.fn()}
      editable
      onSaveMappings={onSaveMappings}
      onMappingDirtyChange={onMappingDirtyChange}
    />,
    { wrapper }
  )
  const input = within(screen.getByTestId('linked-item-mapping')).getByTestId('linked-item-mapping-editor-id')
  return { ...view, onSaveMappings, onMappingDirtyChange, input }
}

const expected = (id: string) => ({ amoy: { [CONTRACT.address]: [{ type: 'single', id }] } })

describe('LinkedItemRow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the URN identifier and saves a mapping change after a pause', () => {
    vi.useFakeTimers()
    const { onSaveMappings, input } = renderRow()
    expect(screen.getByTestId('linked-item-urn')).toHaveTextContent('gold-hat')

    fireEvent.change(input, { target: { value: '12' } })
    expect(onSaveMappings).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1000))

    expect(onSaveMappings).toHaveBeenCalledTimes(1)
    expect(onSaveMappings).toHaveBeenCalledWith(item, expected('12'))
  })

  it('saves a pending change when the row goes away before the pause ends', () => {
    vi.useFakeTimers()
    const { onSaveMappings, input, unmount } = renderRow()

    fireEvent.change(input, { target: { value: '7' } })
    unmount()

    expect(onSaveMappings).toHaveBeenCalledWith(item, expected('7'))
  })

  it('reports an edit as unsaved from the change until its save settles, so publishing can wait for it', async () => {
    vi.useFakeTimers()
    const { onMappingDirtyChange, input } = renderRow()

    fireEvent.change(input, { target: { value: '12' } })
    expect(onMappingDirtyChange).toHaveBeenLastCalledWith('i1', true)
    await act(async () => void vi.advanceTimersByTime(1000))

    expect(onMappingDirtyChange).toHaveBeenLastCalledWith('i1', false)
  })

  it('keeps an edit unsaved when its save fails or the draft is invalid', async () => {
    vi.useFakeTimers()
    const { onMappingDirtyChange, input } = renderRow(vi.fn().mockRejectedValue(new Error('offline')))

    fireEvent.change(input, { target: { value: '12' } })
    await act(async () => void vi.advanceTimersByTime(1000))
    expect(onMappingDirtyChange).not.toHaveBeenCalledWith('i1', false)

    fireEvent.change(input, { target: { value: '' } })
    expect(onMappingDirtyChange).toHaveBeenLastCalledWith('i1', true)
  })

  it('does not save an invalid or unchanged mapping', () => {
    vi.useFakeTimers()
    const { onSaveMappings, input } = renderRow()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: '1' } })
    act(() => void vi.advanceTimersByTime(2000))
    expect(onSaveMappings).not.toHaveBeenCalled()
  })
})
