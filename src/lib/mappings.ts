// Token mappings of linked items: which tokens of the collection's linked contract unlock the item, ported from the
// legacy builder's MappingEditor + modules/item/utils (getMapping / buildItemMappings / areMappingsValid).
import { MappingType, Mappings, type ContractNetwork, type Mapping } from '@dcl/schemas'
import { type LinkedContract } from './thirdParty'

export { MappingType }
export type { Mapping, Mappings }

/** The editor's form state: every value as typed, validated into a `Mapping` on save. */
export type MappingDraft = {
  type: MappingType
  /** `single`: the token id. */
  id: string
  /** `multiple`: the token ids as typed (commas, spaces or newlines between them). */
  ids: string
  /** `range`: both bounds. */
  from: string
  to: string
}

export const EMPTY_MAPPING_DRAFT: MappingDraft = { type: MappingType.ANY, id: '', ids: '', from: '', to: '' }

export const DEFAULT_MAPPING: Mapping = { type: MappingType.ANY }

const TOKEN_ID = /^\d+$/
// uint256 fits in 78 decimal digits.
export const TOKEN_ID_MAX_LENGTH = 78

/** The item's first mapping for the collection's linked contract (legacy getMapping), or null. */
export function getItemMapping(mappings: Mappings | null | undefined, contract: LinkedContract | null): Mapping | null {
  if (!mappings || !contract) return null
  const byAddress = mappings[contract.network]
  if (!byAddress) return null
  const entry = Object.entries(byAddress).find(([address]) => address.toLowerCase() === contract.address.toLowerCase())
  return entry?.[1][0] ?? null
}

/** Wraps a mapping under the collection's contract, the only shape builder-server accepts (one network, one address). */
export function buildItemMappings(mapping: Mapping, contract: LinkedContract): Mappings {
  return { [contract.network]: { [contract.address.toLowerCase()]: [mapping] } }
}

export function parseTokenIds(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map(part => part.trim())
    .filter(part => part.length > 0)
}

export function toMappingDraft(mapping: Mapping | null): MappingDraft {
  if (!mapping) return EMPTY_MAPPING_DRAFT
  switch (mapping.type) {
    case MappingType.SINGLE:
      return { ...EMPTY_MAPPING_DRAFT, type: mapping.type, id: mapping.id }
    case MappingType.MULTIPLE:
      return { ...EMPTY_MAPPING_DRAFT, type: mapping.type, ids: mapping.ids.join(', ') }
    case MappingType.RANGE:
      return { ...EMPTY_MAPPING_DRAFT, type: mapping.type, from: mapping.from, to: mapping.to }
    default:
      return { ...EMPTY_MAPPING_DRAFT, type: MappingType.ANY }
  }
}

/** The mapping the draft describes, or null while it is incomplete or invalid. */
export function fromMappingDraft(draft: MappingDraft): Mapping | null {
  let mapping: Mapping
  switch (draft.type) {
    case MappingType.ANY:
      mapping = { type: MappingType.ANY }
      break
    case MappingType.SINGLE:
      mapping = { type: MappingType.SINGLE, id: draft.id.trim() }
      break
    case MappingType.MULTIPLE:
      mapping = { type: MappingType.MULTIPLE, ids: parseTokenIds(draft.ids) }
      break
    case MappingType.RANGE:
      mapping = { type: MappingType.RANGE, from: draft.from.trim(), to: draft.to.trim() }
      break
    default:
      return null
  }
  return isMappingValid(mapping) ? mapping : null
}

/** Whether a single mapping is well formed: digits only, unique ids, `from <= to`. */
export function isMappingValid(mapping: Mapping): boolean {
  switch (mapping.type) {
    case MappingType.ANY:
      return true
    case MappingType.SINGLE:
      return isTokenId(mapping.id)
    case MappingType.MULTIPLE:
      return mapping.ids.length > 0 && mapping.ids.every(isTokenId) && new Set(mapping.ids).size === mapping.ids.length
    case MappingType.RANGE:
      return isTokenId(mapping.from) && isTokenId(mapping.to) && BigInt(mapping.from) <= BigInt(mapping.to)
    default:
      return false
  }
}

function isTokenId(value: string): boolean {
  return typeof value === 'string' && value.length <= TOKEN_ID_MAX_LENGTH && TOKEN_ID.test(value)
}

/** The schema's own check over the whole payload (legacy areMappingsValid), for what came from a zip or the server. */
export function areMappingsValid(mappings: unknown): mappings is Mappings {
  return Mappings.validate(mappings) === true
}

export function areMappingsEqual(a: Mappings | null | undefined, b: Mappings | null | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** A `wearable.json` mapping as the docs describe it, wrapped under the collection's contract; null when unusable. */
export function mappingsFromManifest(mapping: unknown, contract: LinkedContract | null): Mappings | null {
  if (!contract || !mapping || typeof mapping !== 'object') return null
  const candidate = buildItemMappings(mapping as Mapping, contract)
  return areMappingsValid(candidate) && isMappingValid(mapping as Mapping) ? candidate : null
}

/** The item's token mapping for the collection's linked contract, as the message that labels it. */
export function getMappingLabel(
  mappings: unknown,
  network: string | undefined,
  contractAddress: string | undefined
): { id: string; values?: Record<string, string | number> } {
  const key = (name: string) => `linked_collection.mapping.${name}`
  if (!mappings || typeof mappings !== 'object' || !network || !contractAddress) return { id: key('none') }
  const contracts = (mappings as Mappings)[network as ContractNetwork]
  const entries = contracts
    ? Object.entries(contracts).find(([address]) => address.toLowerCase() === contractAddress.toLowerCase())?.[1]
    : undefined
  if (!Array.isArray(entries) || entries.length === 0) return { id: key('none') }
  if (entries.length > 1) return { id: key('rules'), values: { count: entries.length } }
  const [mapping] = entries
  switch (mapping.type) {
    case MappingType.ANY:
      return { id: key('any') }
    case MappingType.SINGLE:
      return { id: key('single'), values: { id: mapping.id } }
    case MappingType.RANGE:
      return { id: key('range'), values: { from: mapping.from, to: mapping.to } }
    case MappingType.MULTIPLE:
      return { id: key('multiple'), values: { count: mapping.ids.length } }
    default:
      return { id: key('none') }
  }
}
