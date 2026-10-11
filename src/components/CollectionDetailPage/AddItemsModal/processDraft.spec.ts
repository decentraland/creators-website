import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { ItemType } from '~/lib/items'
import { createDraft, type ItemDraft } from './AddItemsModal.state'
import { pickPreviewDraft, processDraftFile } from './processDraft'

const { analyzeModel } = vi.hoisted(() => ({ analyzeModel: vi.fn() }))
vi.mock('~/lib/models', () => ({ analyzeModel }))

function suggest(suggestedCategory: string | null) {
  analyzeModel.mockResolvedValue({ type: 'wearable', validationIssues: [], suggestedCategory })
}
suggest('upper_body')

function draft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return {
    ...createDraft(new File([new Blob(['x'])], 'hat.glb')),
    status: 'ready',
    type: ItemType.WEARABLE,
    contents: { 'model.glb': new Blob(['x']) },
    model: 'model.glb',
    ...overrides
  }
}

const done = { thumbnail: 'data:image/png;base64,x', metrics: { triangles: 1 } }

describe('pickPreviewDraft', () => {
  it('keeps the in-flight draft even when an earlier one becomes ready', () => {
    const drafts = [draft(), draft(), draft()]
    expect(pickPreviewDraft(drafts, drafts[0].id, drafts[2].id)).toBe(drafts[2])
  })

  it('prefers the selected draft over list order when nothing is in flight', () => {
    const drafts = [draft(), draft(), draft()]
    expect(pickPreviewDraft(drafts, drafts[1].id, null)).toBe(drafts[1])
  })

  it('moves on once the in-flight draft has its preview data', () => {
    const drafts = [draft(), draft(done), draft()]
    expect(pickPreviewDraft(drafts, drafts[1].id, drafts[1].id)).toBe(drafts[0])
  })

  it('skips drafts still being analyzed and returns null when everything is done', () => {
    const drafts = [draft({ status: 'processing', type: null }), draft(done)]
    expect(pickPreviewDraft(drafts, drafts[0].id, null)).toBeNull()
  })
})

describe('processDraftFile', () => {
  async function manifestZip({
    category = 'hat',
    hides = [],
    replaces = [],
    ...extra
  }: { category?: string; hides?: string[]; replaces?: string[]; utility?: string } = {}): Promise<File> {
    const zip = new JSZip()
    zip.file(
      'wearable.json',
      JSON.stringify({
        name: 'Hat',
        ...extra,
        data: {
          category,
          replaces,
          hides,
          tags: [],
          representations: [
            {
              bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'],
              mainFile: 'model.glb',
              contents: ['model.glb']
            }
          ]
        }
      })
    )
    zip.file('model.glb', 'glb')
    return new File([await zip.generateAsync({ type: 'arraybuffer' })], 'hat.zip')
  }

  it("keeps the hides a zip's wearable.json declares, unless the live preview set its own", async () => {
    expect((await processDraftFile(await manifestZip({ hides: ['hair'] }))).hides).toEqual(['hair'])
    expect((await processDraftFile(await manifestZip({ hides: ['hair'] }), ['head'])).hides).toEqual(['head'])
  })

  it("adds the slots a zip's wearable.json replaces to the hides, minus the item's own category", async () => {
    const draft = await processDraftFile(await manifestZip({ hides: ['hair', 'hat'], replaces: ['hair', 'earring'] }))
    expect(draft.hides).toEqual(['hair', 'earring'])
  })

  it("keeps a manifest category the model can take and falls back to the suggestion when it can't", async () => {
    expect(await processDraftFile(await manifestZip())).toMatchObject({ category: 'hat', validatedCategory: 'hat' })
    expect(
      await processDraftFile(await manifestZip({ category: 'eyes', hides: ['hair', 'upper_body'] }))
    ).toMatchObject({
      category: 'upper_body',
      validatedCategory: 'upper_body',
      hides: ['hair']
    })
  })

  it('leaves the category empty when the manifest category does not fit and nothing is suggested', async () => {
    suggest(null)
    const draft = await processDraftFile(await manifestZip({ category: 'eyes' }))
    suggest('upper_body')
    expect(draft.category).toBeUndefined()
    expect(draft.validatedCategory).toBeNull()
  })

  it("prefills the manifest's utility", async () => {
    expect((await processDraftFile(await manifestZip({ utility: ' Keeps you warm ' }))).utility).toBe('Keeps you warm')
  })
})
