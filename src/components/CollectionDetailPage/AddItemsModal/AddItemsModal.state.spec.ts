import { describe, expect, it } from 'vitest'
import { BodyShapeType, ItemType, type Item } from '~/lib/items'
import {
  addItemsReducer,
  createDraft,
  createInitialState,
  getCategoryOptions,
  isImageWearable,
  getVariantTargets,
  isDraftComplete,
  type AddItemsState,
  type ItemDraft
} from './AddItemsModal.state'

const blob = (text = 'x') => new Blob([text])

function readyDraft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return {
    ...createDraft(new File([blob()], 'hat.glb')),
    status: 'ready',
    type: ItemType.WEARABLE,
    contents: { 'model.glb': blob(), 'thumbnail.png': blob() },
    model: 'model.glb',
    name: 'Hat',
    category: 'hat',
    thumbnail: 'data:image/png;base64,x',
    metrics: { triangles: 200, materials: 1, textures: 1 },
    ...overrides
  }
}

function smartDraft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  return readyDraft({
    isSmart: true,
    bodyShapeLocked: true,
    requiredPermissions: ['USE_FETCH'],
    contents: { 'model.glb': blob(), 'scene.json': blob(), 'bin/game.js': blob(), 'thumbnail.png': blob() },
    ...overrides
  })
}

function stateWith(drafts: ItemDraft[]): AddItemsState {
  return createInitialState(drafts)
}

function collectionItem(id: string, bodyShapes: string[], overrides: Partial<Item> = {}): Item {
  return {
    id,
    name: `Existing ${id}`,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: '0xowner',
    collectionId: 'col-1',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: {
      representations: [{ bodyShapes, mainFile: 'male/model.glb', contents: ['male/model.glb'] }]
    },
    contents: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

const MALE_URN = 'urn:decentraland:off-chain:base-avatars:BaseMale'

describe('createDraft', () => {
  it('names the draft after the file unless told to leave it blank', () => {
    expect(createDraft(new File([blob()], 'red_hat.glb')).name).toBe('red hat')
    expect(createDraft(new File([blob()], 'model.glb'), { nameFromFile: false }).name).toBe('')
  })
})

describe('review flow', () => {
  it('checking a draft advances the selection to the next unchecked one', () => {
    const [a, b, c] = [readyDraft(), readyDraft(), readyDraft()]
    let state = stateWith([a, b, c])
    state = addItemsReducer(state, { type: 'draftChecked', id: a.id })
    expect(state.drafts.find(draft => draft.id === a.id)?.checked).toBe(true)
    expect(state.selectedId).toBe(b.id)
  })

  it('editing a checked draft clears the check so it must be reviewed again', () => {
    const draft = readyDraft({ checked: true })
    const state = addItemsReducer(stateWith([draft]), { type: 'draftUpdated', id: draft.id, patch: { name: 'New' } })
    expect(state.drafts[0].checked).toBe(false)
  })

  it('re-derives the triangle warning when the category changes', () => {
    const draft = readyDraft({ metrics: { triangles: 900 }, category: 'hat' })
    // 900 triangles is fine for a hat (1500) but not for eyewear (500).
    const state = addItemsReducer(stateWith([draft]), {
      type: 'draftUpdated',
      id: draft.id,
      patch: { category: 'eyewear' }
    })
    expect(state.drafts[0].validationIssues.some(issue => issue.code === 'TRIANGLE_COUNT_EXCEEDED')).toBe(true)
    const back = addItemsReducer(state, { type: 'draftUpdated', id: draft.id, patch: { category: 'hat' } })
    expect(back.drafts[0].validationIssues.some(issue => issue.code === 'TRIANGLE_COUNT_EXCEEDED')).toBe(false)
  })

  it('removing a draft clears variants that pointed at it', () => {
    const base = readyDraft({ bodyShape: BodyShapeType.MALE })
    const variant = readyDraft({
      bodyShape: BodyShapeType.FEMALE,
      isVariant: true,
      variantTargetId: base.id,
      checked: true
    })
    const state = addItemsReducer(stateWith([base, variant]), { type: 'draftRemoved', id: base.id })
    expect(state.drafts).toHaveLength(1)
    expect(state.drafts[0].variantTargetId).toBeNull()
    expect(state.drafts[0].checked).toBe(false)
  })

  it('a failed upload keeps only the failed drafts and switches to the error view', () => {
    const [a, b] = [readyDraft({ checked: true }), readyDraft({ checked: true })]
    const state = addItemsReducer(stateWith([a, b]), {
      type: 'uploadFailed',
      failureReason: 'generic',
      failedDraftIds: [b.id]
    })
    expect(state.view).toBe('error')
    expect(state.drafts.map(draft => draft.id)).toEqual([b.id])
    // Try again returns to the details view with those drafts intact.
    const retried = addItemsReducer(state, { type: 'retryRequested' })
    expect(retried.view).toBe('details')
    expect(retried.drafts).toHaveLength(1)
  })
})

describe('getVariantTargets', () => {
  it('offers batch drafts of the opposite shape and unpublished collection items missing the shape', () => {
    const femaleDraft = readyDraft({ bodyShape: BodyShapeType.FEMALE, name: 'hat 2' })
    const maleDraft = readyDraft({ bodyShape: BodyShapeType.MALE })
    const maleOnlyItem = collectionItem('item-1', [MALE_URN])
    const publishedItem = collectionItem('item-2', [MALE_URN], { isPublished: true })

    const targets = getVariantTargets(femaleDraft, [femaleDraft, maleDraft], [maleOnlyItem, publishedItem])
    expect(targets.map(target => target.id)).toEqual([maleDraft.id, 'item-1'])
  })

  it('offers nothing for a both-shapes draft', () => {
    const draft = readyDraft({ bodyShape: BodyShapeType.BOTH })
    expect(getVariantTargets(draft, [draft], [])).toEqual([])
  })

  it('only pairs image wearables with image wearables and models with models', () => {
    const imageContents = { 'eyes.png': blob(), 'thumbnail.png': blob() }
    const femaleEyes = readyDraft({
      bodyShape: BodyShapeType.FEMALE,
      name: 'eyes 2',
      contents: imageContents,
      model: 'eyes.png',
      category: 'eyes'
    })
    const maleEyes = readyDraft({
      bodyShape: BodyShapeType.MALE,
      name: 'eyes',
      contents: imageContents,
      model: 'eyes.png',
      category: 'eyes'
    })
    const maleHat = readyDraft({ bodyShape: BodyShapeType.MALE })
    const femaleHat = readyDraft({ bodyShape: BodyShapeType.FEMALE, name: 'hat 2' })
    const maleUpperBody = collectionItem('upper', [MALE_URN], {
      data: {
        category: 'upper_body',
        representations: [{ bodyShapes: [MALE_URN], mainFile: 'male/model.glb', contents: ['male/model.glb'] }]
      }
    })
    const maleMouth = collectionItem('mouth', [MALE_URN], {
      data: {
        category: 'mouth',
        representations: [{ bodyShapes: [MALE_URN], mainFile: 'male/mouth.png', contents: ['male/mouth.png'] }]
      }
    })
    const drafts = [femaleEyes, maleEyes, maleHat, femaleHat]
    const items = [maleUpperBody, maleMouth]

    expect(getVariantTargets(femaleEyes, drafts, items).map(target => target.id)).toEqual([maleEyes.id, 'mouth'])
    expect(getVariantTargets(femaleHat, drafts, items).map(target => target.id)).toEqual([maleHat.id, 'upper'])
  })
})

describe('isImageWearable', () => {
  it('is true only for wearables without a model file', () => {
    expect(isImageWearable(readyDraft({ contents: { 'eyes.png': blob() }, model: 'eyes.png' }))).toBe(true)
    expect(isImageWearable(readyDraft())).toBe(false)
    expect(isImageWearable(readyDraft({ type: ItemType.EMOTE }))).toBe(false)
  })
})

describe('getCategoryOptions', () => {
  it('gives model wearables the model category list, image wearables the facial one', () => {
    const model = readyDraft()
    expect(getCategoryOptions(model)).toContain('hat')
    expect(getCategoryOptions(model)).not.toContain('eyes')

    const image = readyDraft({ contents: { 'eyes.png': blob() }, model: 'eyes.png' })
    expect(getCategoryOptions(image)).toEqual(['eyebrows', 'eyes', 'mouth'])
  })

  it('gives emotes the emote category list', () => {
    const emote = readyDraft({ type: ItemType.EMOTE })
    expect(getCategoryOptions(emote)).toContain('dance')
  })
})

describe('isDraftComplete', () => {
  it('accepts a fully reviewed wearable', () => {
    expect(isDraftComplete(readyDraft(), [], [])).toBe(true)
  })

  it('rejects drafts missing name, category, thumbnail or metrics', () => {
    expect(isDraftComplete(readyDraft({ name: '' }), [], [])).toBe(false)
    expect(isDraftComplete(readyDraft({ category: null }), [], [])).toBe(false)
    expect(isDraftComplete(readyDraft({ thumbnail: null }), [], [])).toBe(false)
    expect(isDraftComplete(readyDraft({ metrics: null }), [], [])).toBe(false)
  })

  it('requires a valid target for variants but no name/category', () => {
    const maleDraft = readyDraft({ bodyShape: BodyShapeType.MALE })
    const variant = readyDraft({
      bodyShape: BodyShapeType.FEMALE,
      isVariant: true,
      variantTargetId: maleDraft.id,
      name: '',
      category: null
    })
    expect(isDraftComplete(variant, [variant, maleDraft], [])).toBe(true)
    expect(isDraftComplete({ ...variant, variantTargetId: 'ghost' }, [variant, maleDraft], [])).toBe(false)
    expect(isDraftComplete({ ...variant, variantTargetId: null }, [variant, maleDraft], [])).toBe(false)
  })

  it('rejects items over their size cap', () => {
    const big = readyDraft({ contents: { 'model.glb': new Blob([new Uint8Array(4 * 1024 * 1024)]) } })
    expect(isDraftComplete(big, [], [])).toBe(false)
    expect(isDraftComplete({ ...big, category: 'skin' }, [], [])).toBe(true)
  })
})

describe('smart wearable drafts', () => {
  it('need a preview video to be saved and never act as variant targets', () => {
    const smart = smartDraft()
    expect(isDraftComplete(smart, [smart], [])).toBe(false)
    const withVideo = { ...smart, contents: { ...smart.contents, 'video.mp4': blob() } }
    expect(isDraftComplete(withVideo, [withVideo], [])).toBe(true)
    const single = readyDraft({ bodyShape: BodyShapeType.MALE })
    expect(getVariantTargets(single, [single, smart], [])).toEqual([])
  })

  it('a changed video invalidates the previous review', () => {
    const smart = { ...smartDraft(), checked: true }
    const state = addItemsReducer(stateWith([smart]), {
      type: 'draftUpdated',
      id: smart.id,
      patch: { contents: { ...smart.contents, 'video.mp4': blob() } }
    })
    expect(state.drafts[0].checked).toBe(false)
    expect(state.drafts[0].contents['video.mp4']).toBeDefined()
  })
})
