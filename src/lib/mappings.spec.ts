import { describe, it, expect } from 'vitest'
import { type ContractNetwork } from '@dcl/schemas'
import {
  MappingType,
  areMappingsEqual,
  areMappingsValid,
  buildItemMappings,
  fromMappingDraft,
  getItemMapping,
  getMappingLabel,
  isMappingValid,
  mappingsFromManifest,
  parseTokenIds,
  toMappingDraft,
  EMPTY_MAPPING_DRAFT,
  type Mapping
} from './mappings'

const CONTRACT = { network: 'amoy' as ContractNetwork, address: '0x1d9fb685c257e74f869ba302e260c0b68f5ebb37' }

describe('buildItemMappings / getItemMapping', () => {
  it('wraps the mapping under the collection contract and reads it back, whatever the address casing', () => {
    const mappings = buildItemMappings({ type: MappingType.SINGLE, id: '7' }, CONTRACT)
    expect(mappings).toEqual({ amoy: { [CONTRACT.address]: [{ type: 'single', id: '7' }] } })
    expect(getItemMapping(mappings, { ...CONTRACT, address: CONTRACT.address.toUpperCase() })).toEqual({
      type: 'single',
      id: '7'
    })
  })

  it('is null without mappings, without a contract, or for another contract', () => {
    const mappings = buildItemMappings({ type: MappingType.ANY }, CONTRACT)
    expect(getItemMapping(null, CONTRACT)).toBeNull()
    expect(getItemMapping(mappings, null)).toBeNull()
    expect(getItemMapping(mappings, { ...CONTRACT, address: '0x' + '2'.repeat(40) })).toBeNull()
  })
})

describe('mapping drafts', () => {
  it('round-trips every mapping type', () => {
    const mappings: Mapping[] = [
      { type: MappingType.ANY },
      { type: MappingType.SINGLE, id: '12' },
      { type: MappingType.MULTIPLE, ids: ['1', '2', '3'] },
      { type: MappingType.RANGE, from: '1', to: '1000' }
    ]
    for (const mapping of mappings) expect(fromMappingDraft(toMappingDraft(mapping))).toEqual(mapping)
  })

  it('reads an absent mapping as the empty draft', () => {
    expect(toMappingDraft(null)).toEqual(EMPTY_MAPPING_DRAFT)
  })

  it('is null while the draft is incomplete or invalid', () => {
    expect(fromMappingDraft({ ...EMPTY_MAPPING_DRAFT, type: MappingType.SINGLE, id: '' })).toBeNull()
    expect(fromMappingDraft({ ...EMPTY_MAPPING_DRAFT, type: MappingType.SINGLE, id: '1a' })).toBeNull()
    expect(fromMappingDraft({ ...EMPTY_MAPPING_DRAFT, type: MappingType.RANGE, from: '10', to: '2' })).toBeNull()
    expect(fromMappingDraft({ ...EMPTY_MAPPING_DRAFT, type: MappingType.MULTIPLE, ids: '1, 1' })).toBeNull()
  })

  it('splits typed token ids on commas, spaces and newlines', () => {
    expect(parseTokenIds(' 1, 2\n3;4 ')).toEqual(['1', '2', '3', '4'])
  })
})

describe('isMappingValid / areMappingsValid', () => {
  it('accepts well formed mappings and rejects the rest', () => {
    expect(isMappingValid({ type: MappingType.RANGE, from: '1', to: '1' })).toBe(true)
    expect(isMappingValid({ type: MappingType.MULTIPLE, ids: [] })).toBe(false)
    expect(isMappingValid({ type: MappingType.SINGLE, id: '1'.repeat(79) })).toBe(false)
    // Leading zeros would never match the token, and nothing above uint256 exists.
    expect(isMappingValid({ type: MappingType.SINGLE, id: '007' })).toBe(false)
    expect(isMappingValid({ type: MappingType.MULTIPLE, ids: ['7', '07'] })).toBe(false)
    expect(isMappingValid({ type: MappingType.SINGLE, id: '0' })).toBe(true)
    expect(isMappingValid({ type: MappingType.SINGLE, id: (2n ** 256n - 1n).toString() })).toBe(true)
    expect(isMappingValid({ type: MappingType.SINGLE, id: (2n ** 256n).toString() })).toBe(false)
  })

  it('validates the whole payload with the schema', () => {
    expect(areMappingsValid(buildItemMappings({ type: MappingType.ANY }, CONTRACT))).toBe(true)
    expect(areMappingsValid({ amoy: { [CONTRACT.address]: [{ type: 'single' }] } })).toBe(false)
    expect(areMappingsValid({ amoy: { 'not-an-address': [{ type: 'any' }] } })).toBe(false)
  })
})

describe('mappingsFromManifest', () => {
  it('wraps a valid wearable.json mapping under the collection contract', () => {
    expect(mappingsFromManifest({ type: 'range', from: '1', to: '5' }, CONTRACT)).toEqual(
      buildItemMappings({ type: MappingType.RANGE, from: '1', to: '5' }, CONTRACT)
    )
  })

  it('is null without a contract or for an invalid mapping', () => {
    expect(mappingsFromManifest({ type: 'any' }, null)).toBeNull()
    expect(mappingsFromManifest({ type: 'single' }, CONTRACT)).toBeNull()
    expect(mappingsFromManifest('any', CONTRACT)).toBeNull()
  })
})

describe('areMappingsEqual', () => {
  it('compares by value, treating null and undefined alike', () => {
    const a = buildItemMappings({ type: MappingType.SINGLE, id: '1' }, CONTRACT)
    expect(areMappingsEqual(a, { ...a })).toBe(true)
    expect(areMappingsEqual(a, buildItemMappings({ type: MappingType.SINGLE, id: '2' }, CONTRACT))).toBe(false)
    expect(areMappingsEqual(null, undefined)).toBe(true)
  })
})

describe('getMappingLabel', () => {
  const mappingsFor = (...entries: unknown[]) => ({ amoy: { [CONTRACT.address]: entries } })
  const label = (id: string, values?: Record<string, string | number>) => ({
    id: `linked_collection.mapping.${id}`,
    ...(values && { values })
  })

  it('names each mapping type', () => {
    expect(getMappingLabel(mappingsFor({ type: 'any' }), 'amoy', CONTRACT.address)).toEqual(label('any'))
    expect(getMappingLabel(mappingsFor({ type: 'single', id: '7' }), 'amoy', CONTRACT.address)).toEqual(
      label('single', { id: '7' })
    )
    expect(getMappingLabel(mappingsFor({ type: 'range', from: '1', to: '9' }), 'amoy', CONTRACT.address)).toEqual(
      label('range', { from: '1', to: '9' })
    )
    expect(getMappingLabel(mappingsFor({ type: 'multiple', ids: ['1', '2'] }), 'amoy', CONTRACT.address)).toEqual(
      label('multiple', { count: 2 })
    )
  })

  it('counts several rules and reads anything else as no mapping', () => {
    expect(getMappingLabel(mappingsFor({ type: 'any' }, { type: 'any' }), 'amoy', CONTRACT.address)).toEqual(
      label('rules', { count: 2 })
    )
    expect(getMappingLabel(null, 'amoy', CONTRACT.address)).toEqual(label('none'))
    expect(getMappingLabel(mappingsFor({ type: 'any' }), 'matic', CONTRACT.address)).toEqual(label('none'))
  })
})
