import { describe, expect, it } from 'vitest'
import { BodyShape, PreviewEmote } from '@dcl/schemas'
import { buildPreviewOptions, definitionToBase64, getPreviewZoom, itemToDefinition } from './preview'
import { ItemType, type Item } from './items'
import { type AvatarAttributes } from './avatar'

const wearable: Item = {
  id: 'w1',
  name: 'Hat',
  description: 'A hat',
  thumbnail: 'thumbnail.png',
  owner: '0xabc',
  isPublished: false,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: {
    category: 'hat',
    hides: ['hair'],
    representations: [{ bodyShapes: [BodyShape.MALE], mainFile: 'male/hat.glb', contents: ['male/hat.glb'] }]
  },
  contents: { 'male/hat.glb': 'bafyglb', 'thumbnail.png': 'bafythumb' },
  createdAt: 1,
  updatedAt: 1
}

const emote: Item = {
  ...wearable,
  id: 'e1',
  type: ItemType.EMOTE,
  data: {
    category: 'dance',
    loop: true,
    representations: [
      { bodyShapes: [BodyShape.MALE, BodyShape.FEMALE], mainFile: 'male/dance.glb', contents: ['male/dance.glb'] }
    ]
  },
  contents: { 'male/dance.glb': 'bafyemote' }
}

const avatar: AvatarAttributes = {
  bodyShape: BodyShape.FEMALE,
  skin: 'ffe4c6',
  eyes: '362626',
  hair: '1c1c1c',
  baseWearableUrns: ['urn:hair']
}

describe('itemToDefinition', () => {
  it('resolves every content path to its storage url and keeps the item id', () => {
    const definition = itemToDefinition(wearable)
    expect(definition.id).toBe('w1')
    expect('data' in definition && definition.data.representations[0].contents).toEqual([
      { key: 'male/hat.glb', url: 'https://builder-api.decentraland.zone/v1/storage/contents/bafyglb' }
    ])
    expect('data' in definition && definition.data.hides).toEqual(['hair'])
  })

  it('builds an emote definition with its loop flag', () => {
    const definition = itemToDefinition(emote)
    expect('emoteDataADR74' in definition && definition.emoteDataADR74.loop).toBe(true)
  })

  it('encodes definitions the way the preview url expects', () => {
    const definition = itemToDefinition(wearable)
    expect(JSON.parse(atob(definitionToBase64(definition)))).toEqual(definition)
  })
})

describe('buildPreviewOptions', () => {
  it('sends the avatar, the dressed items and the chosen animation', () => {
    const options = buildPreviewOptions({ kind: 'items', items: [wearable] }, avatar, PreviewEmote.DANCE)
    expect(options).toMatchObject({
      bodyShape: BodyShape.FEMALE,
      skin: 'ffe4c6',
      urns: ['urn:hair'],
      emote: PreviewEmote.DANCE,
      disableDefaultEmotes: false
    })
    expect(options.base64s).toHaveLength(1)
    expect(options.zoom).toBe(getPreviewZoom(PreviewEmote.DANCE))
  })

  it('lets an emote item own the animation and frames the jump further out', () => {
    const withEmote = buildPreviewOptions({ kind: 'items', items: [wearable, emote] }, avatar, PreviewEmote.DANCE)
    expect(withEmote.disableDefaultEmotes).toBe(true)
    expect(withEmote.emote).toBeUndefined()
    const jump = buildPreviewOptions({ kind: 'items', items: [] }, avatar, PreviewEmote.JUMP).zoom!
    const dance = buildPreviewOptions({ kind: 'items', items: [] }, avatar, PreviewEmote.DANCE).zoom!
    // A lower zoom is a larger camera radius: the jump has to fit in frame.
    expect(jump).toBeLessThan(dance)
    // Both are scaled together, so the camera starts where the legacy editor framed it.
    expect(dance / jump).toBe(1.75)
  })
})
