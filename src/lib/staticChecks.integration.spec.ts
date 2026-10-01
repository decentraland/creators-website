import { describe, expect, it } from 'vitest'
import { type Collection } from './collections'
import { BODY_SHAPE_MALE, ItemType, type Item } from './items'
import { runStaticChecks } from './staticChecks'

// The real validator package on a bogus model: it must answer findings, never throw, and keep the
// finding shape the UI reads (rule, severity, message, fix).
describe('wearable-validator end to end', () => {
  it('runs the code checks on a broken model and reports them as findings', async () => {
    const collection = {
      id: 'c1',
      name: 'Hats',
      urn: 'urn:decentraland:amoy:collections-v2:0xcollection',
      contractAddress: '0xcollection'
    } as Collection
    const item = {
      id: 'i1',
      name: 'Hat',
      description: '',
      thumbnail: 'thumbnail.png',
      owner: '0x',
      rarity: 'common',
      isPublished: false,
      isApproved: false,
      inCatalyst: false,
      type: ItemType.WEARABLE,
      data: {
        category: 'hat',
        representations: [{ bodyShapes: [BODY_SHAPE_MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] }],
        hides: [],
        replaces: [],
        tags: []
      },
      metrics: { triangles: 1 },
      contents: { 'male/hat.glb': 'bafyglb', 'thumbnail.png': 'bafythumb' },
      createdAt: 1,
      updatedAt: 1
    } as Item
    const result = await runStaticChecks(collection, [item], {
      fetchContent: () => Promise.resolve(new Blob(['nope']))
    })
    expect(result.errors).toBeGreaterThan(0)
    const finding = result.items[0].findings.find(candidate => candidate.severity === 'error')
    expect(finding).toMatchObject({ rule: expect.stringMatching(/^[A-Z]-\d+$/), message: expect.any(String) })
    expect(typeof finding?.fix).toBe('string')
  })
})
