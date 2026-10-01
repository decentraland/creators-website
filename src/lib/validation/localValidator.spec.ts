import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BodyShape } from '@dcl/schemas'
import { ItemType, type Item } from '../items'

const validate = vi.fn()
vi.mock('@dcl-regenesislabs/wearable-validator', () => ({ validate: (...args: unknown[]) => validate(...args) }))

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
      { bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] },
      { bodyShapes: [BodyShape.FEMALE], mainFile: 'female/hat.glb', contents: ['female/hat.glb'] }
    ]
  },
  contents: { 'male/hat.glb': 'bafyM', 'female/hat.glb': 'bafyF', 'thumbnail.png': 'bafyThumb' },
  createdAt: 1,
  updatedAt: 1
}

const finding = { check: 'triangle-count', severity: 'error', message: 'Too many triangles', where: 'female/hat.glb' }
const fetchMock = vi.fn()

beforeEach(() => {
  validate.mockReset().mockResolvedValue({ findings: [finding], checks: [] })
  fetchMock.mockReset().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])))
  vi.stubGlobal('fetch', fetchMock)
  setValidator(localValidator)
})

describe('local validator', () => {
  it('fetches the asked body shape from storage and validates it with category and hides', async () => {
    const result = await getValidator().validate(
      { kind: 'item', item },
      { type: ItemType.WEARABLE, category: 'hat', hides: ['hair'], bodyShape: BodyShape.FEMALE }
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://builder-api.decentraland.zone/v1/storage/contents/bafyF')
    const [input, options] = validate.mock.calls[0]
    expect([...input.files.keys()]).toEqual(['female/hat.glb'])
    expect(input.metadata).toEqual({ data: { category: 'hat', hides: ['hair'] } })
    expect(options.groups).toEqual(['model', 'emote'])
    expect(result.issues).toEqual([
      { code: 'triangle-count', severity: 'error', message: 'Too many triangles', where: 'female/hat.glb' }
    ])
  })

  it('validates in-memory files and marks emotes through their metadata', async () => {
    await getValidator().validate(
      { kind: 'blob', contents: { 'dance.glb': new Blob(['x']) }, mainFile: 'dance.glb' },
      { type: ItemType.EMOTE }
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(validate.mock.calls[0][0].metadata).toEqual({ emoteDataADR74: {} })
  })

  it('hides category-unknown warnings and reports an unparseable model as an error', async () => {
    validate.mockResolvedValue({
      findings: [{ ...finding, severity: 'warning', data: { reason: 'category-unknown' } }],
      checks: [{ check: 'skeleton', status: 'skipped', skipReason: '"hat.glb" failed to parse' }]
    })
    const result = await getValidator().validate({ kind: 'item', item }, { type: ItemType.WEARABLE })
    expect(result.issues).toEqual([{ code: 'file-format', severity: 'error', message: '"hat.glb" failed to parse' }])
  })

  it('skips texture-only wearables', async () => {
    const png = {
      ...item,
      data: { ...item.data, representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'eyes.png', contents: [] }] },
      contents: { 'eyes.png': 'bafyE' }
    } as Item
    await expect(getValidator().validate({ kind: 'item', item: png }, { type: ItemType.WEARABLE })).resolves.toEqual({
      issues: []
    })
    expect(validate).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aborts a run whose signal was cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      getValidator().validate({ kind: 'item', item }, { type: ItemType.WEARABLE }, { signal: controller.signal })
    ).rejects.toThrow()
  })
})
