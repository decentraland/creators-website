import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BodyShape } from '@dcl/schemas'
import { ItemType, type Item } from '../items'

const loadGltf = vi.fn()
const validateWearableGLTF = vi.fn()
const validateEmoteGLTF = vi.fn()
vi.mock('../models', () => ({ loadGltf: (...args: unknown[]) => loadGltf(...args) }))
vi.mock('../glbValidation', async importOriginal => ({
  ...(await importOriginal<typeof import('../glbValidation')>()),
  validateWearableGLTF: (...args: unknown[]) => validateWearableGLTF(...args),
  validateEmoteGLTF: (...args: unknown[]) => validateEmoteGLTF(...args)
}))

const { getValidator, setValidator } = await import('./index')
const { localValidator } = await import('./localValidator')

const item: Item = {
  id: 'w1',
  name: 'Hat',
  description: '',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: {
    category: 'hat',
    hides: ['hair'],
    representations: [
      { bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb', 'male/tex.png'] },
      { bodyShapes: [BodyShape.FEMALE], mainFile: 'female/hat.glb', contents: ['female/hat.glb'] }
    ]
  },
  contents: {
    'male/hat.glb': 'bafyM',
    'male/tex.png': 'bafyT',
    'female/hat.glb': 'bafyF',
    'thumbnail.png': 'bafyThumb'
  },
  createdAt: 1,
  updatedAt: 1
}

const issue = { code: 'X', severity: 'warning', messageKey: 'item_validation.x' }

beforeEach(() => {
  loadGltf.mockReset().mockResolvedValue({ scene: { children: [] }, animations: [] })
  validateWearableGLTF.mockReset().mockResolvedValue({ issues: [issue], isValid: true })
  validateEmoteGLTF.mockReset().mockResolvedValue({ issues: [], isValid: true })
  setValidator(localValidator)
})

describe('local validator', () => {
  it('loads a saved item from storage with the full content mapping and validates the body shape asked for', async () => {
    const result = await getValidator().validate(
      { kind: 'item', item },
      { type: ItemType.WEARABLE, category: 'hat', hides: ['hair'], bodyShape: BodyShape.FEMALE }
    )
    expect(result.issues).toEqual([issue])
    const [url, mappings] = loadGltf.mock.calls[0] as [string, Record<string, string>]
    expect(url).toBe('https://builder-api.decentraland.zone/v1/storage/contents/bafyF')
    expect(mappings['male/tex.png']).toBe('https://builder-api.decentraland.zone/v1/storage/contents/bafyT')
    expect(validateWearableGLTF).toHaveBeenCalledWith(expect.anything(), 'hat', ['hair'])
  })

  it('validates in-memory files through object urls and releases them', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    await getValidator().validate(
      { kind: 'blob', contents: { 'hat.glb': new Blob(['x']) }, mainFile: 'hat.glb' },
      { type: ItemType.WEARABLE }
    )
    expect(loadGltf).toHaveBeenCalledWith('blob:x', { 'hat.glb': 'blob:x' })
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('skips texture-only wearables and runs the emote suite for emotes', async () => {
    const png = {
      ...item,
      data: {
        ...item.data,
        representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'eyes.png', contents: ['eyes.png'] }]
      },
      contents: { 'eyes.png': 'bafyE' }
    }
    await expect(getValidator().validate({ kind: 'item', item: png }, { type: ItemType.WEARABLE })).resolves.toEqual({
      issues: []
    })
    expect(loadGltf).not.toHaveBeenCalled()
    await getValidator().validate({ kind: 'item', item: { ...item, type: ItemType.EMOTE } }, { type: ItemType.EMOTE })
    expect(validateEmoteGLTF).toHaveBeenCalled()
  })

  it('aborts a run whose signal was cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      getValidator().validate({ kind: 'item', item }, { type: ItemType.WEARABLE }, { signal: controller.signal })
    ).rejects.toThrow(/aborted/i)
  })

  it('validates many entries in order', async () => {
    const results = await getValidator().validateMany([
      { source: { kind: 'item', item }, ctx: { type: ItemType.WEARABLE } },
      { source: { kind: 'item', item }, ctx: { type: ItemType.WEARABLE } }
    ])
    expect(results).toHaveLength(2)
  })
})
