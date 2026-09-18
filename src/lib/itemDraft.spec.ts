import { describe, expect, it } from 'vitest'
import { BodyShape } from '@dcl/schemas'
import {
  applyDraftToItem,
  toPreviewItem,
  canUpdateVideo,
  computeRemovesDefaultHiding,
  createItemDraft,
  isItemDraftDirty,
  itemDraftReducer,
  toSaveableItem
} from './itemDraft'
import { ItemType, type Item } from './items'

const item: Item = {
  id: 'w1',
  name: 'Hat',
  description: 'A hat',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
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
    representations: [
      {
        bodyShapes: [BodyShape.MALE],
        mainFile: 'male/hat.glb',
        contents: ['male/hat.glb'],
        overrideHides: [],
        overrideReplaces: []
      }
    ]
  },
  contents: { 'male/hat.glb': 'bafyglb', 'thumbnail.png': 'bafythumb', 'video.mp4': 'bafyvideo' },
  createdAt: 1,
  updatedAt: 1
}

describe('item draft', () => {
  it('starts from the item, folding legacy replaces into hides', () => {
    const draft = createItemDraft(item)
    expect(draft.hides).toEqual(['hair', 'helmet'])
    expect(draft.outlineCompatible).toBe(true)
    expect(isItemDraftDirty(draft, item)).toBe(false)
  })

  it('tracks edits and picked files as dirty', () => {
    const draft = createItemDraft(item)
    expect(isItemDraftDirty(itemDraftReducer(draft, { type: 'setText', field: 'name', value: 'Cap' }), item)).toBe(true)
    expect(isItemDraftDirty(itemDraftReducer(draft, { type: 'setThumbnail', thumbnail: new Blob(['x']) }), item)).toBe(
      true
    )
    expect(isItemDraftDirty(itemDraftReducer(draft, { type: 'setTags', tags: [' cool ', 'cool'] }), item)).toBe(false)
  })

  it('clears the hides when the wearable becomes a skin', () => {
    const draft = itemDraftReducer(createItemDraft(item), { type: 'setCategory', category: 'skin' })
    expect(draft.hides).toEqual([])
    expect(itemDraftReducer(createItemDraft(item), { type: 'setCategory', category: 'helmet' }).hides).toEqual([
      'hair',
      'helmet'
    ])
  })

  it('projects the draft onto the item with mirrored overrides and default hiding', () => {
    let draft = createItemDraft(item)
    draft = itemDraftReducer(draft, { type: 'setCategory', category: 'upper_body' })
    draft = itemDraftReducer(draft, { type: 'setText', field: 'utility', value: ' glows ' })
    const next = applyDraftToItem(item, draft)
    expect(next.data.category).toBe('upper_body')
    expect(next.data.replaces).toEqual([])
    expect(next.data.removesDefaultHiding).toEqual(['hands'])
    expect(next.data.representations[0].overrideHides).toEqual(['hair', 'helmet'])
    expect(next.utility).toBe('glows')
    expect(computeRemovesDefaultHiding('hat', ['upper_body'])).toEqual(['hands'])
    expect(computeRemovesDefaultHiding('hat', [])).toEqual([])
  })

  it('keeps display-only edits out of what the renderer is handed', () => {
    let draft = createItemDraft(item)
    draft = itemDraftReducer(draft, { type: 'setText', field: 'name', value: 'Cap' })
    draft = itemDraftReducer(draft, { type: 'setText', field: 'description', value: 'New' })
    draft = itemDraftReducer(draft, { type: 'setTags', tags: ['new'] })
    const preview = toPreviewItem(item, draft)
    expect(preview.name).toBe(item.name)
    expect(preview.description).toBe(item.description)
    expect(preview.data.tags).toEqual(item.data.tags)
    // What the renderer does read still comes from the draft.
    draft = itemDraftReducer(draft, { type: 'setHides', hides: ['hat'] })
    expect(toPreviewItem(item, draft).data.hides).toEqual(['hat'])
  })

  it('hashes new files into the save and merges the spring bones', async () => {
    let draft = createItemDraft(item)
    draft = itemDraftReducer(draft, { type: 'setThumbnail', thumbnail: new Blob(['png'], { type: 'image/png' }) })
    draft = itemDraftReducer(draft, { type: 'setVideo', video: new Blob(['mp4']) })
    const springBones = {
      version: 1,
      models: {
        bafyglb: {
          Bone_springbone: {
            stiffness: 1,
            gravityPower: 0,
            gravityDir: [0, -1, 0] as [number, number, number],
            drag: 0.5
          }
        }
      }
    }
    const { item: saved, blobs } = await toSaveableItem(item, draft, { springBones })
    expect(Object.keys(blobs).sort()).toEqual(['image.png', 'thumbnail.png', 'video.mp4'])
    expect(saved.contents['thumbnail.png']).not.toBe('bafythumb')
    expect(saved.video).toBe(saved.contents['video.mp4'])
    expect(saved.video).not.toBe('bafyvideo')
    expect(saved.data.springBones).toEqual(springBones)
  })

  it('freezes the video once the item is approved', async () => {
    const approved = { ...item, isPublished: true, isApproved: true }
    expect(canUpdateVideo(approved)).toBe(false)
    const draft = itemDraftReducer(createItemDraft(approved), { type: 'setVideo', video: new Blob(['mp4']) })
    const { item: saved, blobs } = await toSaveableItem(approved, draft)
    expect(blobs['video.mp4']).toBeUndefined()
    expect(saved.contents['video.mp4']).toBe('bafyvideo')
  })
})
