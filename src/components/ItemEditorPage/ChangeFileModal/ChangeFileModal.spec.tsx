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
// The preview iframe is what fills metrics and the auto thumbnail; here it answers at once (or when the
// test releases it) and records which draft it was handed.
const processed = vi.hoisted(() => ({
  runs: [] as Array<{ id: string; model: string; files: string }>,
  defer: false,
  pending: [] as Array<() => void>
}))
vi.mock('~/components/CollectionDetailPage/AddItemsModal', async importOriginal => ({
  ...(await importOriginal<typeof import('~/components/CollectionDetailPage/AddItemsModal')>()),
  DraftProcessor: ({
    draft,
    onResult
  }: {
    draft: { id: string; model: string; contents: Record<string, Blob> }
    onResult: (id: string, patch: unknown) => void
  }) => {
    useEffect(() => {
      processed.runs.push({ id: draft.id, model: draft.model, files: Object.keys(draft.contents).sort().join() })
      const deliver = () =>
        onResult(draft.id, {
          metrics: { triangles: draft.id.length },
          thumbnail: 'data:image/png;base64,AAAA',
          contents: { ...draft.contents, 'thumbnail.png': new Blob(['render']) }
        })
      if (processed.defer) processed.pending.push(deliver)
      else deliver()
      // The real processor starts a new run for every draft id it is handed.
    }, [draft.id])
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
  const onApply = vi.fn<(result: ChangeFileResult) => Promise<void>>().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<ChangeFileModal item={item} lockedBodyShape={lockedBodyShape} onSave={onApply} onClose={onClose} />, {
    wrapper: Providers
  })
  return { onApply, onClose }
}

async function loadFile() {
  await userEvent.click(screen.getByTestId('change-file-browse'))
  await screen.findByTestId('change-file-form')
}

beforeEach(() => {
  processed.runs.length = 0
  processed.pending.length = 0
  processed.defer = false
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  pickFile.mockReset().mockResolvedValue(new File(['glb'], 'new.glb'))
  loadItemFile
    .mockReset()
    .mockResolvedValue({ contents: { 'new.glb': new Blob(['new']) }, model: 'new.glb', bodyShape: null })
  analyzeModel.mockReset().mockResolvedValue({ type: ItemType.WEARABLE, validationIssues: [], suggestedCategory: null })
})

describe('ChangeFileModal', () => {
  it('loads the file, starts from the item shapes and saves the new model with its render as thumbnail', async () => {
    const { onApply, onClose } = renderModal(maleOnly)
    await loadFile()
    expect(screen.getByTestId('body-shape-male')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('change-file-effect')).toHaveTextContent('Replaces the Male model only')
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-save'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    const result = onApply.mock.calls[0][0]
    expect(result.update.item.data.representations.map(representation => representation.mainFile)).toEqual([
      'male/new.glb'
    ])
    expect(Object.keys(result.update.blobs)).toEqual(['male/new.glb'])
    expect(result.thumbnail).toBeInstanceOf(Blob)
    expect(result.category).toBeNull()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('stays open for another try when the save fails', async () => {
    const { onApply, onClose } = renderModal(maleOnly)
    onApply.mockRejectedValueOnce(new Error('server down'))
    await loadFile()
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-save'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('change-file-form')).toBeInTheDocument()
  })

  it('lets a unisex item take the new model for one shape only, keeping the other', async () => {
    const { onApply } = renderModal(unisex)
    await loadFile()
    expect(screen.getByTestId('body-shape-both')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByTestId('body-shape-female'))
    expect(screen.getByTestId('change-file-effect')).toHaveTextContent('Replaces the Female model only')
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-save'))
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
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-save'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    const { update } = onApply.mock.calls[0][0]
    expect(update.item.data.representations.map(representation => representation.mainFile)).toEqual([
      'male/hat.glb',
      'female/a.glb'
    ])
    expect(Object.keys(update.blobs)).toEqual(['female/a.glb'])
  })

  it('measures and renders the picked folder of a zip with both body shapes, same file names included', async () => {
    loadItemFile.mockResolvedValue({
      contents: {
        'male/model.glb': new Blob(['m']),
        'female/model.glb': new Blob(['f']),
        'shared.png': new Blob(['s'])
      },
      model: 'male/model.glb',
      bodyShape: BodyShapeType.BOTH
    })
    const { onApply } = renderModal(unisex)
    await loadFile()
    await userEvent.click(screen.getByTestId('body-shape-female'))
    await waitFor(() => expect(processed.runs).toHaveLength(2))
    expect(processed.runs[1]).toMatchObject({ model: 'model.glb', files: 'model.glb,shared.png' })
    expect(processed.runs[1].id).not.toBe(processed.runs[0].id)
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-save'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    const { update } = onApply.mock.calls[0][0]
    expect(update.item.metrics).toEqual({ triangles: processed.runs[1].id.length })
    expect(update.item.data.representations[1].mainFile).toBe('female/model.glb')
  })

  it('drops the result of a run still measuring the previous folder', async () => {
    processed.defer = true
    loadItemFile.mockResolvedValue({
      contents: { 'male/model.glb': new Blob(['m']), 'female/model.glb': new Blob(['f']) },
      model: 'male/model.glb',
      bodyShape: BodyShapeType.BOTH
    })
    renderModal(unisex)
    await loadFile()
    await userEvent.click(screen.getByTestId('body-shape-female'))
    await waitFor(() => expect(processed.pending).toHaveLength(2))
    // The male run lands late: the female pick must still be waiting for its own.
    processed.pending[0]()
    expect(screen.getByTestId('change-file-save')).toBeDisabled()
    processed.pending[1]()
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
  })

  it('refuses a smart zip for a single representation', async () => {
    loadItemFile.mockResolvedValue({
      contents: { 'sw.glb': new Blob(['g']), 'scene.json': new Blob(['{}']) },
      model: 'sw.glb',
      bodyShape: BodyShapeType.BOTH,
      scene: { requiredPermissions: [] }
    })
    renderModal(maleOnly, BodyShapeType.FEMALE)
    await loadFile()
    expect(screen.getByTestId('change-file-pick-error')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('draft-thumbnail')).toBeInTheDocument())
    expect(screen.getByTestId('change-file-save')).toBeDisabled()
  })

  it('keeps the item thumbnail when the creator unticks the render', async () => {
    const { onApply } = renderModal(maleOnly)
    await loadFile()
    await userEvent.click(screen.getByTestId('change-file-keep-thumbnail'))
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())
    await userEvent.click(screen.getByTestId('change-file-save'))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    expect(onApply.mock.calls[0][0].thumbnail).toBeNull()
  })

  it('asks for a category when a texture replaces the only model and blocks a texture next to a model', async () => {
    loadItemFile.mockResolvedValue({ contents: { 'eyes.png': new Blob(['png']) }, model: 'eyes.png', bodyShape: null })
    const { onApply } = renderModal(maleOnly)
    await loadFile()
    expect(screen.getByTestId('change-file-category')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('draft-thumbnail')).toBeInTheDocument())
    expect(screen.getByTestId('change-file-save')).toBeDisabled()
    await userEvent.click(screen.getByTestId('change-file-category'))
    await userEvent.click(screen.getByTestId('change-file-category-option-eyes'))
    await waitFor(() => expect(screen.getByTestId('change-file-save')).toBeEnabled())

    // A texture can't sit next to the kept male model.
    await userEvent.click(screen.getByTestId('body-shape-female'))
    expect(screen.getByTestId('change-file-pick-error')).toBeInTheDocument()
    expect(screen.getByTestId('change-file-save')).toBeDisabled()

    await userEvent.click(screen.getByTestId('body-shape-male'))
    await userEvent.click(screen.getByTestId('change-file-save'))
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
