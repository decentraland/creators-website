import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { type SpringBoneParams } from '@dcl/schemas'
import { ItemType, type Item } from '~/lib/items'
import { carrySpringBonesForSave } from './useSpringBones'

function glb(json: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(json))
  const padded = Math.ceil(bytes.length / 4) * 4
  const buffer = new ArrayBuffer(12 + 8 + padded)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, padded, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(buffer, 20).fill(0x20)
  new Uint8Array(buffer, 20).set(bytes)
  return buffer
}

const tail = glb({ nodes: [{ name: 'Avatar_Hips', children: [1] }, { name: 'Tail_springbone_1' }] })
const plain = glb({ nodes: [{ name: 'Avatar_Hips' }] })

vi.mock('~/lib/builder', async () => ({
  ...(await vi.importActual<typeof import('~/lib/builder')>('~/lib/builder')),
  fetchContent: () => Promise.resolve(new Blob([tail]))
}))

const MALE = 'urn:decentraland:off-chain:base-avatars:BaseMale'
const tuned: SpringBoneParams = { stiffness: 3, gravityPower: 1, gravityDir: [0, -1, 0], drag: 0.1, isRoot: true }

function wearable(hash: string, springBones?: Record<string, Record<string, SpringBoneParams>>): Item {
  return {
    id: 'w1',
    name: 'Tail',
    description: '',
    thumbnail: 'thumbnail.png',
    owner: '0xabc',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: {
      category: 'top_head',
      representations: [{ bodyShapes: [MALE], mainFile: 'tail.glb', contents: ['tail.glb'] }],
      springBones: springBones && { version: 1, models: springBones }
    },
    contents: { 'tail.glb': hash },
    createdAt: 1,
    updatedAt: 1
  }
}

describe('carrySpringBonesForSave', () => {
  it('carries the saved params onto the new model by bone name', async () => {
    const saved = wearable('bafyOld', { bafyOld: { Tail_springbone_1: tuned } })
    const pending = { item: wearable('bafyNew'), blobs: { 'tail.glb': new Blob([tail]) } }
    const data = await carrySpringBonesForSave(new QueryClient(), saved, pending)
    expect(data).toEqual({ version: 1, models: { bafyNew: { Tail_springbone_1: tuned } } })
  })

  it('drops the params when the new model has no spring bones, and leaves emotes alone', async () => {
    const saved = wearable('bafyOld', { bafyOld: { Tail_springbone_1: tuned } })
    const pending = { item: wearable('bafyPlain'), blobs: { 'tail.glb': new Blob([plain]) } }
    expect(await carrySpringBonesForSave(new QueryClient(), saved, pending)).toBeNull()
    const emote = { ...wearable('bafyOld'), type: ItemType.EMOTE }
    expect(await carrySpringBonesForSave(new QueryClient(), emote, { item: emote, blobs: {} })).toBeUndefined()
  })
})
