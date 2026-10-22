import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BodyShape } from '@dcl/schemas'
import { Providers } from '~/components/CollectionDetailPage/SellItemFlow/testUtils'
import { BodyShapeType, ItemType, type Item } from '~/lib/items'
import { ChangeFileModal, type ChangeFileResult } from './ChangeFileModal'

const pickFile = vi.fn()
const loadItemFile = vi.fn()
const analyzeModel = vi.fn()
vi.mock('~/lib/filePicker', () => ({ pickFile: (...args: unknown[]) => pickFile(...args) }))
vi.mock('~/lib/itemFiles', async importOriginal => ({
  ...(await importOriginal<typeof import('~/lib/itemFiles')>()),
  loadItemFile: (...args: unknown[]) => loadItemFile(...args)
}))
vi.mock('~/lib/models', () => ({ analyzeModel: (...args: unknown[]) => analyzeModel(...args) }))
vi.mock('~/hooks/useThumbnailValidation', () => ({ useThumbnailValidation: () => ({ data: undefined }) }))
// The preview iframe is what fills metrics and the auto thumbnail; here it answers at once.
vi.mock('~/components/CollectionDetailPage/AddItemsModal', async importOriginal => ({
  ...(await importOriginal<typeof import('~/components/CollectionDetailPage/AddItemsModal')>()),
  DraftProcessor: ({
    draft,
    onResult
  }: {
    draft: { id: string; contents: Record<string, Blob> }
    onResult: (id: string, patch: unknown) => void
  }) => {
    useEffect(() => {
      onResult(draft.id, {
        metrics: { triangles: 7 },
        thumbnail: 'data:image/png;base64,AAAA',
        contents: { ...draft.contents, 'thumbnail.png': new Blob(['render']) }
      })
    }, [])
    return null
  },
  imageThumbnailPatch: (contents: Record<string, Blob>) =>
    Promise.resolve({
      thumbnail: 'data:image/png;base64,BBBB',
      contents: { ...contents, 'thumbnail.png': new Blob(['pad']) }
    })
}))

const maleOnly: Item = {
  id: 'w1',
  name: 'Hat',
  description: '',
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
    representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] }]
  },
  contents: { 'male/hat.glb': 'bafyOld', 'thumbnail.png': 'bafyThumb' },
  createdAt: 1,
  updatedAt: 1
}

const unisex: Item = {
  ...maleOnly,
  data: {
    category: 'hat',
    representations: [
      { bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] },
      { bodyShapes: [BodyShape.FEMALE], mainFile: 'female/hat.glb', contents: ['female/hat.glb'] }
    ]
  },
  contents: { 'male/hat.glb': 'bafyMale', 'female/hat.glb': 'bafyFemale', 'thumbnail.png': 'bafyThumb' }
}

function renderModal(item: Item, lockedBodyShape?: BodyShapeType.MALE | BodyShapeType.FEMALE) {
  const onApply = vi.fn<(result: ChangeFileResult) => void>()
  const onClose = vi.fn()
  render(<ChangeFileModal item={item} lockedBodyShape={lockedBodyShape} onApply={onApply} onClose={onClose} />, {
    wrapper: Providers
  })
  return { onApply, onClose }
}

async function loadFile() {
  await userEvent.click(screen.getByTestId('change-file-browse'))
  await screen.findByTestId('change-file-form')
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  pickFile.mockReset().mockResolvedValue(new File(['glb'], 'new.glb'))
  loadItemFile
    .mockReset()
    .mockResolvedValue({ contents: { 'new.glb': new Blob(['new']) }, model: 'new.glb', bodyShape: null })
  analyzeModel.mockReset().mockResolvedValue({ type: ItemType.WEARABLE, validationIssues: [], suggestedCategory: null })
})

describe('ChangeFileModal', () => {
  it('loads the file, starts from the item shapes and applies the new model with its render as thumbnail', async () => {
    const { onApply } = renderModal(maleOnly)
    await loadFile()
    expect(screen.getByTestId('body-shape-male')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('change-file-effect')).toHaveTextContent('Replaces the Male model only')
    await waitFor(() => expect(screen.getByTestId('change-file-apply')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-apply'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    const result = onApply.mock.calls[0][0]
    expect(result.mode).toBe('replace_shape')
    expect(result.update.item.data.representations.map(representation => representation.mainFile)).toEqual([
      'male/new.glb'
    ])
    expect(Object.keys(result.update.blobs)).toEqual(['male/new.glb'])
    expect(result.thumbnail).toBeInstanceOf(Blob)
    expect(result.category).toBeNull()
  })

  it('lets a unisex item take the new model for one shape only, keeping the other', async () => {
    const { onApply } = renderModal(unisex)
    await loadFile()
    expect(screen.getByTestId('body-shape-both')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByTestId('body-shape-female'))
    expect(screen.getByTestId('change-file-effect')).toHaveTextContent('Replaces the Female model only')
    await waitFor(() => expect(screen.getByTestId('change-file-apply')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-apply'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    const { update } = onApply.mock.calls[0][0]
    expect(update.item.data.representations[0]).toEqual(unisex.data.representations[0])
    expect(update.item.data.representations[1].mainFile).toBe('female/new.glb')
    expect(update.item.contents['male/hat.glb']).toBe('bafyMale')
  })

  it('adds the missing representation from a zip with both body shapes when the pick is fixed', async () => {
    loadItemFile.mockResolvedValue({
      contents: { 'male/a.glb': new Blob(['a']), 'female/a.glb': new Blob(['b']) },
      model: 'male/a.glb',
      bodyShape: BodyShapeType.BOTH
    })
    const { onApply } = renderModal(maleOnly, BodyShapeType.FEMALE)
    expect(screen.getByTestId('change-file-modal')).toHaveTextContent('Add Female representation')
    await loadFile()
    expect(screen.getByTestId('body-shape-female')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('change-file-effect')).toHaveTextContent('Adds a Female model')
    await userEvent.click(screen.getByTestId('body-shape-both'))
    expect(screen.getByTestId('body-shape-female')).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(screen.getByTestId('change-file-apply')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-apply'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    const { update, mode } = onApply.mock.calls[0][0]
    expect(mode).toBe('add_representation')
    expect(update.item.data.representations.map(representation => representation.mainFile)).toEqual([
      'male/hat.glb',
      'female/a.glb'
    ])
    expect(Object.keys(update.blobs)).toEqual(['female/a.glb'])
  })

  it('keeps the item thumbnail when the creator unticks the render', async () => {
    const { onApply } = renderModal(maleOnly)
    await loadFile()
    await userEvent.click(screen.getByTestId('change-file-keep-thumbnail'))
    await waitFor(() => expect(screen.getByTestId('change-file-apply')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-apply'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    expect(onApply.mock.calls[0][0].thumbnail).toBeNull()
  })

  it('asks for a category when a texture replaces the only model and blocks a texture next to a model', async () => {
    loadItemFile.mockResolvedValue({ contents: { 'eyes.png': new Blob(['png']) }, model: 'eyes.png', bodyShape: null })
    const { onApply } = renderModal(maleOnly)
    await loadFile()
    expect(screen.getByTestId('change-file-category')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('draft-thumbnail')).toBeInTheDocument())
    expect(screen.getByTestId('change-file-apply')).toBeDisabled()
    await userEvent.click(screen.getByTestId('change-file-category'))
    await userEvent.click(screen.getByTestId('change-file-category-option-eyes'))
    await waitFor(() => expect(screen.getByTestId('change-file-apply')).toBeEnabled())

    // A texture can't sit next to the kept male model.
    await userEvent.click(screen.getByTestId('body-shape-female'))
    expect(screen.getByTestId('change-file-pick-error')).toBeInTheDocument()
    expect(screen.getByTestId('change-file-apply')).toBeDisabled()

    await userEvent.click(screen.getByTestId('body-shape-male'))
    await userEvent.click(screen.getByTestId('change-file-apply'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    expect(onApply.mock.calls[0][0].category).toBe('eyes')
  })

  it('shows why a file was refused and keeps the dropzone', async () => {
    analyzeModel.mockResolvedValue({
      type: ItemType.EMOTE,
      validationIssues: [],
      suggestedCategory: null,
      emoteMetrics: {}
    })
    const { onApply } = renderModal(maleOnly)
    await userEvent.click(screen.getByTestId('change-file-browse'))
    expect(await screen.findByTestId('change-file-error')).toHaveTextContent('different item type')
    expect(screen.getByTestId('change-file-dropzone')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('confirms before discarding a loaded file', async () => {
    const { onClose } = renderModal(maleOnly)
    await loadFile()
    await userEvent.click(screen.getByTestId('change-file-cancel'))
    expect(screen.getByTestId('change-file-discard-modal')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('change-file-discard'))
    expect(onClose).toHaveBeenCalled()
  })
})
