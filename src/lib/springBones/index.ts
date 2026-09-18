// Spring bone physics for wearables, ported from the legacy builder's lib/springBones: default
// params, chain roots, subtree sizes (the MAX_SPRING_BONES cap counts every bone a chain drives) and
// the merge back into `item.data.springBones`, keyed by representation model hash.
import { type SpringBoneParams, type SpringBonesData } from '@dcl/schemas'
import { MAX_SPRING_BONES } from '../glbValidation/constants'
import { ItemType, type Item } from '../items'
import { type BoneNode } from './parseSpringBones'

export { parseSpringBones, extractGltfJson, type BoneNode } from './parseSpringBones'

export const SPRING_BONES_VERSION = 1

/** Params per spring bone name, for one model. */
export type SpringBoneParamsByName = Record<string, SpringBoneParams>
/** Params per model hash: what `item.data.springBones.models` holds. */
export type SpringBoneParamsByHash = Record<string, SpringBoneParamsByName>

export function getDefaultSpringBoneParams(): SpringBoneParams {
  return { stiffness: 2, gravityPower: 0, gravityDir: [0, -1, 0], drag: 0.5, isRoot: true }
}

export function getSpringBones(bones: BoneNode[]): BoneNode[] {
  return bones.filter(bone => bone.type === 'spring')
}

export function hasSpringBones(bones: BoneNode[]): boolean {
  return bones.some(bone => bone.type === 'spring')
}

function countSubtreeSize(boneById: Map<number, BoneNode>, nodeId: number): number {
  const bone = boneById.get(nodeId)
  if (!bone) return 0
  return bone.children.reduce((count, childId) => count + countSubtreeSize(boneById, childId), 1)
}

/** Spring bone name → number of bones its chain drives (itself plus descendants). */
export function buildSubtreeSizes(bones: BoneNode[]): Map<string, number> {
  const boneById = new Map(bones.map(bone => [bone.nodeId, bone]))
  return new Map(getSpringBones(bones).map(bone => [bone.name, countSubtreeSize(boneById, bone.nodeId)]))
}

/** Bones driven by every configured chain, against the MAX_SPRING_BONES cap. */
export function sumConfiguredBones(subtreeSizes: Map<string, number>, params: SpringBoneParamsByName): number {
  return Object.keys(params).reduce((total, name) => total + (subtreeSizes.get(name) ?? 1), 0)
}

/** Spring bones whose parent is not a spring bone: the only sensible chain starts. */
export function getChainRoots(bones: BoneNode[]): BoneNode[] {
  const parentById = new Map<number, number>()
  const springIds = new Set<number>()
  for (const bone of bones) {
    if (bone.type === 'spring') springIds.add(bone.nodeId)
    for (const childId of bone.children) parentById.set(childId, bone.nodeId)
  }
  return getSpringBones(bones).filter(bone => {
    const parentId = parentById.get(bone.nodeId)
    return parentId === undefined || !springIds.has(parentId)
  })
}

/**
 * Default params for the chain roots, admitted greedily in node order while the driven-bone total
 * stays within the cap (a root too big for the remaining budget is skipped, smaller ones may still fit).
 */
export function getDefaultSpringBoneRoots(bones: BoneNode[]): SpringBoneParamsByName {
  const subtreeSizes = buildSubtreeSizes(bones)
  const roots: SpringBoneParamsByName = {}
  let total = 0
  for (const root of getChainRoots(bones)) {
    const size = subtreeSizes.get(root.name) ?? 1
    if (total + size > MAX_SPRING_BONES) continue
    roots[root.name] = getDefaultSpringBoneParams()
    total += size
  }
  return roots
}

/** Bone names in depth-first tree order, so configured chains list top-down like the model. */
export function sortByHierarchy(bones: BoneNode[], names: string[]): string[] {
  const order = new Map<string, number>()
  const boneById = new Map(bones.map(bone => [bone.nodeId, bone]))
  const childIds = new Set(bones.flatMap(bone => bone.children))
  let index = 0
  const visit = (nodeId: number) => {
    const bone = boneById.get(nodeId)
    if (!bone) return
    order.set(bone.name, index++)
    bone.children.forEach(visit)
  }
  for (const bone of bones) if (!childIds.has(bone.nodeId)) visit(bone.nodeId)
  return [...names].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
}

/** The content hash of each representation's main model, de-duplicated (a unisex GLB appears once). */
export function getRepresentationModelHashes(item: Item): string[] {
  const hashes: string[] = []
  for (const representation of item.data.representations) {
    const hash = item.contents[representation.mainFile]
    if (hash && !hashes.includes(hash)) hashes.push(hash)
  }
  return hashes
}

/** Saved params for one model, or the seeded defaults when the item has none yet. */
export function getInitialSpringBoneParams(item: Item, hash: string, bones: BoneNode[]): SpringBoneParamsByName {
  const saved = item.data.springBones?.models[hash]
  if (saved) {
    // Bones that left the model since the params were saved are dropped.
    const names = new Set(getSpringBones(bones).map(bone => bone.name))
    return Object.fromEntries(Object.entries(saved).filter(([name]) => names.has(name)))
  }
  return getDefaultSpringBoneRoots(bones)
}

/** `item.data.springBones` for the given params; undefined when no model has any chain configured. */
export function mergeSpringBonesIntoItem(paramsByHash: SpringBoneParamsByHash): SpringBonesData | undefined {
  const models: SpringBoneParamsByHash = {}
  for (const [hash, params] of Object.entries(paramsByHash)) {
    if (Object.keys(params).length > 0) models[hash] = params
  }
  return Object.keys(models).length > 0 ? { version: SPRING_BONES_VERSION, models } : undefined
}

export function isSpringBoneItem(item: Item): boolean {
  return item.type === ItemType.WEARABLE
}

/**
 * For a two-model item, the hashes whose model has spring bones but no chain configured while the
 * other model has some: saving would ship physics for one body shape only.
 */
export function getShapesMissingSpringBones(
  paramsByHash: SpringBoneParamsByHash,
  bonesByHash: Record<string, BoneNode[]>
): string[] {
  const hashes = Object.keys(bonesByHash).filter(hash => hasSpringBones(bonesByHash[hash]))
  if (hashes.length < 2) return []
  const configured = hashes.filter(hash => Object.keys(paramsByHash[hash] ?? {}).length > 0)
  if (configured.length === 0 || configured.length === hashes.length) return []
  return hashes.filter(hash => !configured.includes(hash))
}
