// How a zip's wearable.json lands in a linked collection: which item it is (its URN) and which tokens unlock it.
import { type Item } from './items'
import { ItemFileError } from './itemFiles'
import { DEFAULT_MAPPING, getItemMapping, mappingsFromManifest, type Mapping } from './mappings'
import { decodeLinkedUrn, type LinkedContract } from './thirdParty'

/** The linked collection a zip is imported into. */
export type LinkedManifestTarget = {
  collectionUrn: string
  contract: LinkedContract | null
  /** Edit in bulk: the collection's items by URN. Each zip must name one of them, and keeps its mapping if it sets none. */
  updating?: Map<string, Item>
}

export type LinkedManifestFields = {
  /** The item URN's own segment, when the manifest fixed it; generated from the name otherwise. */
  urnSuffix: string | null
  mapping: Mapping
}

/**
 * Reads the `id` and `mapping` of a wearable.json for a linked collection. Throws ItemFileError when the URN belongs
 * to another collection, the mapping is invalid, or (editing in bulk) the zip names no item of this collection.
 */
export function resolveLinkedManifest(
  manifest: { id?: string | null; mapping?: unknown } | undefined,
  target: LinkedManifestTarget
): LinkedManifestFields {
  const id = manifest?.id ?? undefined
  const decoded = id ? decodeLinkedUrn(id) : null
  if (id && (!decoded?.itemSuffix || !id.startsWith(`${target.collectionUrn}:`))) {
    throw new ItemFileError('linked_urn_mismatch')
  }
  const existing = target.updating && id ? target.updating.get(id) : undefined
  if (target.updating) {
    if (!id) throw new ItemFileError('bulk_edit_missing_urn')
    if (!existing) throw new ItemFileError('bulk_edit_no_match')
  }
  let mapping: Mapping
  if (manifest?.mapping !== undefined && manifest.mapping !== null) {
    const mappings = mappingsFromManifest(manifest.mapping, target.contract)
    const parsed = getItemMapping(mappings, target.contract)
    if (!parsed) throw new ItemFileError('linked_mapping_invalid')
    mapping = parsed
  } else {
    mapping = getItemMapping(existing?.mappings, target.contract) ?? DEFAULT_MAPPING
  }
  return { urnSuffix: decoded?.itemSuffix ?? null, mapping }
}
