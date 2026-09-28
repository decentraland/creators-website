import { describe, expect, it } from 'vitest'
import {
  buildBoneTree,
  buildSubtreeSizes,
  getChainRoots,
  getDefaultSpringBoneParams,
  getDefaultSpringBoneRoots,
  getInitialSpringBoneParams,
  getRepresentationModelHashes,
  getShapesMissingSpringBones,
  mergeSpringBonesIntoItem,
  parseSpringBones,
  sameSpringBoneParams,
  sortByHierarchy,
  sumConfiguredBones,
  type BoneNode
} from './index'
import { ItemType, type Item } from '../items'

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

// Hips → [Tail_springbone_1 → Tail_springbone_2, Hair_springbone → Hair_end]
const nodes = [
  { name: 'Avatar_Hips', children: [1, 3] },
  { name: 'Tail_springbone_1', children: [2] },
  { name: 'Tail_springbone_2' },
  { name: 'Hair_springbone', children: [4] },
  { name: 'Hair_end' }
]

describe('spring bones', () => {
  it('reads the node tree out of a GLB and flags spring bones by name', () => {
    const bones = parseSpringBones(glb({ nodes }))
    expect(bones.map(bone => bone.type)).toEqual(['avatar', 'spring', 'spring', 'spring', 'avatar'])
    expect(parseSpringBones(glb({}))).toEqual([])
    expect(parseSpringBones(new TextEncoder().encode(JSON.stringify({ nodes })).buffer)).toHaveLength(5)
  })

  it('builds a bone tree from the model\u2019s skin joints', () => {
    // Armature and the mesh node are not joints: the tree lifts Hips to the top and drops the mesh.
    const bones = parseSpringBones(
      glb({
        nodes: [
          { name: 'Armature', children: [1] },
          { name: 'Hips', children: [2, 3] },
          { name: 'Tail_springbone_1' },
          { name: 'Wearable_mesh' }
        ],
        skins: [{ joints: [1, 2] }]
      })
    )
    expect(bones.map(bone => bone.isJoint)).toEqual([false, true, true, false])
    const tree = buildBoneTree(bones)
    expect(tree.map(node => node.bone.name)).toEqual(['Hips'])
    expect(tree[0].children.map(node => node.bone.name)).toEqual(['Tail_springbone_1'])
  })

  it('treats every node as a bone when the model declares no skin', () => {
    expect(buildBoneTree(parseSpringBones(glb({ nodes }))).map(node => node.bone.name)).toEqual(['Avatar_Hips'])
  })

  it('finds chain roots and how many bones each chain drives', () => {
    const bones = parseSpringBones(glb({ nodes }))
    expect(getChainRoots(bones).map(bone => bone.name)).toEqual(['Tail_springbone_1', 'Hair_springbone'])
    const sizes = buildSubtreeSizes(bones)
    expect(sizes.get('Tail_springbone_1')).toBe(2)
    expect(sizes.get('Hair_springbone')).toBe(2)
    const roots = getDefaultSpringBoneRoots(bones)
    expect(Object.keys(roots)).toEqual(['Tail_springbone_1', 'Hair_springbone'])
    expect(sumConfiguredBones(sizes, roots)).toBe(4)
    expect(roots.Hair_springbone).toMatchObject({ stiffness: 2, drag: 0.5, gravityDir: [0, -1, 0] })
  })

  it('admits roots greedily under the cap', () => {
    const big: BoneNode[] = [{ name: 'Root_springbone', nodeId: 0, type: 'spring', isJoint: true, children: [] }]
    for (let i = 1; i <= 13; i++) {
      big[i - 1].children.push(i)
      big.push({ name: `Chain_springbone_${i}`, nodeId: i, type: 'spring', isJoint: true, children: [] })
    }
    big.push({ name: 'Small_springbone', nodeId: 14, type: 'spring', isJoint: true, children: [] })
    expect(Object.keys(getDefaultSpringBoneRoots(big))).toEqual(['Small_springbone'])
  })

  it('orders configured chains like the model hierarchy', () => {
    const bones = parseSpringBones(glb({ nodes }))
    expect(sortByHierarchy(bones, ['Hair_springbone', 'Tail_springbone_1'])).toEqual([
      'Tail_springbone_1',
      'Hair_springbone'
    ])
  })

  it('keys params by representation model hash and merges them back into the item', () => {
    const item: Item = {
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
        representations: [
          { bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'], mainFile: 'male/tail.glb', contents: [] },
          {
            bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseFemale'],
            mainFile: 'female/tail.glb',
            contents: []
          }
        ],
        springBones: {
          version: 1,
          models: {
            bafyA: {
              Tail_springbone_1: { stiffness: 3, gravityPower: 0, gravityDir: [0, -1, 0], drag: 0.1 },
              Gone_springbone: { stiffness: 1, gravityPower: 0, gravityDir: [0, -1, 0], drag: 0.1 }
            }
          }
        }
      },
      contents: { 'male/tail.glb': 'bafyA', 'female/tail.glb': 'bafyA', 'thumbnail.png': 'bafyT' },
      createdAt: 1,
      updatedAt: 1
    }
    expect(getRepresentationModelHashes(item)).toEqual(['bafyA'])
    const bones = parseSpringBones(glb({ nodes }))
    const initial = getInitialSpringBoneParams(item, 'bafyA', bones)
    expect(Object.keys(initial)).toEqual(['Tail_springbone_1'])
    expect(initial.Tail_springbone_1.stiffness).toBe(3)
    expect(mergeSpringBonesIntoItem({ bafyA: initial, bafyB: {} })).toEqual({ version: 1, models: { bafyA: initial } })
    expect(mergeSpringBonesIntoItem({ bafyA: {} })).toBeUndefined()
  })

  it('warns when a two-model item has chains on one shape only', () => {
    const bones = parseSpringBones(glb({ nodes }))
    const params = getDefaultSpringBoneRoots(bones)
    expect(getShapesMissingSpringBones({ bafyA: params, bafyB: {} }, { bafyA: bones, bafyB: bones })).toEqual(['bafyB'])
    expect(getShapesMissingSpringBones({ bafyA: params, bafyB: params }, { bafyA: bones, bafyB: bones })).toEqual([])
    expect(getShapesMissingSpringBones({ bafyA: params }, { bafyA: bones })).toEqual([])
  })
})

describe('sameSpringBoneParams', () => {
  const chain = () => ({ ...getDefaultSpringBoneParams(), stiffness: 3 })

  it('compares by value, not by key order', () => {
    const a = { m: { Tail_springbone: chain(), Hair_springbone: chain() } }
    const b = { m: { Hair_springbone: chain(), Tail_springbone: chain() } }
    expect(sameSpringBoneParams(a, b)).toBe(true)
  })

  it('sees an edited param, an added chain and a dropped model', () => {
    const base = { m: { Tail_springbone: chain() } }
    expect(sameSpringBoneParams(base, { m: { Tail_springbone: { ...chain(), drag: 0.9 } } })).toBe(false)
    expect(sameSpringBoneParams(base, { m: { Tail_springbone: { ...chain(), center: 'Hips' } } })).toBe(false)
    expect(sameSpringBoneParams(base, { m: { Tail_springbone: chain(), Hair_springbone: chain() } })).toBe(false)
    expect(sameSpringBoneParams(base, {})).toBe(false)
  })
})
