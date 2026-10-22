import { useMemo } from 'react'
import { useQueries, type QueryClient } from '@tanstack/react-query'
import { fetchContent } from '~/lib/builder'
import { type BuiltItem } from '~/lib/itemFactory'
import { type Item } from '~/lib/items'
import {
  carrySpringBoneParams,
  getInitialSpringBoneParams,
  getRepresentationModelHashes,
  hasSpringBones,
  isSpringBoneItem,
  mergeSpringBonesIntoItem,
  parseSpringBones,
  type BoneNode,
  type SpringBoneParamsByHash,
  type SpringBonesCarrySource
} from '~/lib/springBones'

export type SpringBonesModel = {
  hash: string
  /** Body shapes whose representation uses this model. */
  bodyShapes: string[]
  bones: BoneNode[]
}

export type SpringBonesData = {
  isLoading: boolean
  /** Some model couldn't be read: its spring bones are unknown, not absent. */
  isError: boolean
  /** Models with spring bones, in representation order. */
  models: SpringBonesModel[]
  /** Saved params (or seeded defaults) per model hash: the form's pristine state. */
  initialParams: SpringBoneParamsByHash
  bonesByHash: Record<string, BoneNode[]>
}

const EMPTY: SpringBonesData = { isLoading: false, isError: false, models: [], initialParams: {}, bonesByHash: {} }

function springBonesQuery(hash: string, blob?: Blob) {
  return {
    queryKey: ['spring-bones', hash],
    queryFn: async () => parseSpringBones(await (blob ?? (await fetchContent(hash))).arrayBuffer()),
    staleTime: Infinity
  }
}

/** The new model's files by hash: they exist only in memory, storage would 404 on them. */
function pendingBlobsByHash(pending: BuiltItem): Record<string, Blob> {
  const blobs: Record<string, Blob> = {}
  for (const [path, blob] of Object.entries(pending.blobs)) {
    const hash = pending.item.contents[path]
    if (hash) blobs[hash] = blob
  }
  return blobs
}

/**
 * The spring bones to store with a model change saved on its own: the saved params carried onto the new
 * models by bone name (legacy seedSpringBonesForUpdate), defaults for roots new to them. `null` when no
 * new model has spring bones (the replaced model's params go), `undefined` for items without models.
 */
export async function carrySpringBonesForSave(
  queryClient: QueryClient,
  item: Item,
  pending: BuiltItem
): Promise<NonNullable<ReturnType<typeof mergeSpringBonesIntoItem>> | null | undefined> {
  const next = pending.item
  if (!isSpringBoneItem(next)) return undefined
  const hashes = getRepresentationModelHashes(next)
  if (hashes.length === 0) return undefined
  const source: SpringBonesCarrySource = { item, params: item.data.springBones?.models ?? {} }
  const sourceHashes = isSpringBoneItem(item) ? getRepresentationModelHashes(item) : []
  const blobsByHash = pendingBlobsByHash(pending)
  const parsed: Record<string, BoneNode[]> = {}
  await Promise.all(
    [...new Set([...hashes, ...sourceHashes])].map(async hash => {
      parsed[hash] = await queryClient.fetchQuery(springBonesQuery(hash, blobsByHash[hash]))
    })
  )
  const carried = carrySpringBoneParams(source, next, parsed)
  const params: SpringBoneParamsByHash = {}
  for (const hash of hashes) {
    const bones = parsed[hash]
    if (!bones || !hasSpringBones(bones)) continue
    params[hash] = carried[hash] ?? getInitialSpringBoneParams(item, hash, bones)
  }
  return mergeSpringBonesIntoItem(params) ?? null
}

/**
 * Parses each representation GLB of a wearable for spring bones and merges the item's saved params.
 * With a pending model change, the models are the new ones and their params carry over from `carryFrom`
 * (the saved item when omitted).
 */
export function useSpringBones(
  item: Item | null,
  pending: BuiltItem | null = null,
  carryFrom: SpringBonesCarrySource | null = null
): SpringBonesData {
  const current = pending?.item ?? item
  const hashes = useMemo(
    () => (current && isSpringBoneItem(current) ? getRepresentationModelHashes(current) : []),
    [current]
  )
  const source = useMemo<SpringBonesCarrySource | null>(() => {
    if (!pending || !item) return null
    return carryFrom ?? { item, params: item.data.springBones?.models ?? {} }
  }, [pending, item, carryFrom])
  const sourceHashes = useMemo(
    () => (source && isSpringBoneItem(source.item) ? getRepresentationModelHashes(source.item) : []),
    [source]
  )
  const parsed = useMemo(() => [...new Set([...hashes, ...sourceHashes])], [hashes, sourceHashes])
  const blobsByHash = useMemo(() => (pending ? pendingBlobsByHash(pending) : {}), [pending])
  const queries = useQueries({ queries: parsed.map(hash => springBonesQuery(hash, blobsByHash[hash])) })
  const isLoading = queries.some(query => query.isLoading)
  const isError = queries.some(query => query.isError)
  // One scalar stands in for the per-query results: a dependency array must keep its length. Not
  // memoized on purpose: `queries` is a new array every render, so a useMemo keyed on it would
  // recompute every render anyway — this map is what produces the stable key the real memo uses.
  const dataVersion = queries.map(query => query.dataUpdatedAt).join('|')
  return useMemo(() => {
    if (!item || !current || hashes.length === 0) return EMPTY
    const parsedBones: Record<string, BoneNode[]> = {}
    parsed.forEach((hash, index) => {
      const bones = queries[index].data
      if (bones) parsedBones[hash] = bones
    })
    // Carrying needs the saved models' bones too, to tell a new root from one removed on purpose.
    if (source && isLoading) return { ...EMPTY, isLoading }
    const carried = source ? carrySpringBoneParams(source, current, parsedBones) : null
    const models: SpringBonesModel[] = []
    const initialParams: SpringBoneParamsByHash = {}
    const bonesByHash: Record<string, BoneNode[]> = {}
    for (const hash of hashes) {
      const bones = parsedBones[hash]
      if (!bones || !hasSpringBones(bones)) continue
      const bodyShapes = current.data.representations
        .filter(representation => current.contents[representation.mainFile] === hash)
        .flatMap(representation => representation.bodyShapes)
      models.push({ hash, bodyShapes, bones })
      bonesByHash[hash] = bones
      initialParams[hash] = carried?.[hash] ?? getInitialSpringBoneParams(item, hash, bones)
    }
    return { isLoading, isError, models, initialParams, bonesByHash }
    // `queries` is a fresh array every render; dataVersion tracks the results that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, current, source, hashes, parsed, isLoading, isError, dataVersion])
}
