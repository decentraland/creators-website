import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { fetchContent } from '~/lib/builder'
import { type BuiltItem } from '~/lib/itemFactory'
import { type Item } from '~/lib/items'
import {
  carrySpringBoneParams,
  getInitialSpringBoneParams,
  getRepresentationModelHashes,
  hasSpringBones,
  isSpringBoneItem,
  parseSpringBones,
  type BoneNode,
  type SpringBoneParamsByHash
} from '~/lib/springBones'

export type SpringBonesModel = {
  hash: string
  /** Body shapes whose representation uses this model. */
  bodyShapes: string[]
  bones: BoneNode[]
}

export type SpringBonesData = {
  isLoading: boolean
  /** Models with spring bones, in representation order. */
  models: SpringBonesModel[]
  /** Saved params (or seeded defaults) per model hash: the form's pristine state. */
  initialParams: SpringBoneParamsByHash
  bonesByHash: Record<string, BoneNode[]>
}

const EMPTY: SpringBonesData = { isLoading: false, models: [], initialParams: {}, bonesByHash: {} }

/**
 * Parses each representation GLB of a wearable for spring bones and merges the item's saved params.
 * With a pending model change, the models are the new ones and their params carry over from the saved item.
 */
export function useSpringBones(item: Item | null, pending: BuiltItem | null = null): SpringBonesData {
  const current = pending?.item ?? item
  const hashes = useMemo(
    () => (current && isSpringBoneItem(current) ? getRepresentationModelHashes(current) : []),
    [current]
  )
  const sourceHashes = useMemo(
    () => (pending && item && isSpringBoneItem(item) ? getRepresentationModelHashes(item) : []),
    [pending, item]
  )
  const parsed = useMemo(() => [...new Set([...hashes, ...sourceHashes])], [hashes, sourceHashes])
  // An unsaved model exists only in memory: storage would 404 on its hash.
  const blobsByHash = useMemo(() => {
    if (!pending) return {}
    const blobs: Record<string, Blob> = {}
    for (const [path, blob] of Object.entries(pending.blobs)) {
      const hash = pending.item.contents[path]
      if (hash) blobs[hash] = blob
    }
    return blobs
  }, [pending])
  const queries = useQueries({
    queries: parsed.map(hash => ({
      queryKey: ['spring-bones', hash],
      queryFn: async () => parseSpringBones(await (blobsByHash[hash] ?? (await fetchContent(hash))).arrayBuffer()),
      staleTime: Infinity
    }))
  })
  const isLoading = queries.some(query => query.isLoading)
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
    if (pending && isLoading) return { ...EMPTY, isLoading }
    const carried = pending ? carrySpringBoneParams(item, current, parsedBones) : null
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
    return { isLoading, models, initialParams, bonesByHash }
    // `queries` is a fresh array every render; dataVersion tracks the results that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, current, pending, hashes, parsed, isLoading, dataVersion])
}
