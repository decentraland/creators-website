import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type SpringBoneParams } from '@dcl/schemas'
import { type ReactNode } from 'react'
import { ItemType, type Item } from '~/lib/items'
import { useItemForm } from './useItemForm'

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

const model = glb({ nodes: [{ name: 'Avatar_Hips', children: [1] }, { name: 'Tail_springbone_1' }] })

vi.mock('~/lib/builder', async () => ({
  ...(await vi.importActual<typeof import('~/lib/builder')>('~/lib/builder')),
  fetchContent: () => Promise.resolve(new Blob([model]))
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
      representations: [{ bodyShapes: [MALE], mainFile: 'tail.glb', contents: [] }],
      springBones: springBones && { version: 1, models: springBones }
    },
    contents: { 'tail.glb': hash },
    createdAt: 1,
    updatedAt: 1
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

const saved = wearable('bafyOld', { bafyOld: { Tail_springbone_1: tuned } })

describe('useItemForm spring bones on a model change', () => {
  it('shows the picked model and carries the chains as they stood, unsaved tuning included', async () => {
    const { result } = renderHook(() => useItemForm(saved), { wrapper })
    await waitFor(() => expect(result.current.springBones.models).toHaveLength(1))
    const unsaved = { ...tuned, drag: 0.9 }
    act(() => result.current.setSpringBoneParams({ bafyOld: { Tail_springbone_1: unsaved } }))

    const update = { item: wearable('bafyNew'), blobs: { 'tail.glb': new Blob([model]) } }
    act(() => result.current.dispatch({ type: 'setFileUpdate', update }))

    await waitFor(() => expect(result.current.springBones.models.map(({ hash }) => hash)).toEqual(['bafyNew']))
    expect(result.current.springBoneParams).toEqual({ bafyNew: { Tail_springbone_1: unsaved } })
  })
})
