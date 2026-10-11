import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { ItemType } from '~/lib/items'
import { createDraft, type ItemDraft } from './AddItemsModal.state'
import { pickPreviewDraft, processDraftFile } from './processDraft'

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

vi.mock('~/lib/models', () => ({
  analyzeModel: () => Promise.resolve({ type: 'wearable', validationIssues: [], suggestedCategory: 'upper_body' })
}))

describe('processDraftFile', () => {
  async function modelZip(category: string, extra: Record<string, unknown> = {}): Promise<File> {
    const zip = new JSZip()
    zip.file(
      'wearable.json',
      JSON.stringify({
        name: 'Jacket',
        ...extra,
        data: {
          category,
          replaces: [],
          hides: [],
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
    return new File([await zip.generateAsync({ type: 'arraybuffer' })], 'jacket.zip')
  }

  it("keeps a manifest category the model can take and falls back to the suggestion when it can't", async () => {
    expect(await processDraftFile(await modelZip('hat'))).toMatchObject({ category: 'hat', validatedCategory: 'hat' })
    expect(await processDraftFile(await modelZip('eyes'))).toMatchObject({
      category: 'upper_body',
      validatedCategory: 'upper_body'
    })
  })
  it("prefills the manifest's utility", async () => {
    expect((await processDraftFile(await modelZip('hat', { utility: ' Keeps you warm ' }))).utility).toBe(
      'Keeps you warm'
    )
  })
})
