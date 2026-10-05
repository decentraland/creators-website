import { describe, it, expect } from 'vitest'
import { CurationStatus } from './collections'
import {
  LinkedItemStatus,
  builderLinkedCollectionUrl,
  getLinkedItemStatus,
  getThirdPartyId,
  isThirdPartyManager,
  summarizeMapping
} from './linkedCollections'

const CONTRACT = '0x1d9fb685c257e74f869ba302e260c0b68f5ebb37'

describe('getThirdPartyId', () => {
  it('is the collection URN without its collection suffix', () => {
    expect(getThirdPartyId({ urn: 'urn:decentraland:amoy:collections-thirdparty:brand:hats' })).toBe(
      'urn:decentraland:amoy:collections-thirdparty:brand'
    )
  })

  it('is absent for standard collections', () => {
    expect(getThirdPartyId({ urn: 'urn:decentraland:amoy:collections-v2:0xcontract' })).toBeUndefined()
  })
})

describe('isThirdPartyManager', () => {
  const thirdParty = { name: 'Brand X', managers: ['0xAbC0000000000000000000000000000000000001'] }

  it("lets the third party's managers in, whatever the address casing", () => {
    expect(isThirdPartyManager(thirdParty, '0xabc0000000000000000000000000000000000001')).toBe(true)
  })

  it('keeps everyone else out', () => {
    expect(isThirdPartyManager(thirdParty, '0xdef0000000000000000000000000000000000002')).toBe(false)
    expect(isThirdPartyManager(thirdParty, undefined)).toBe(false)
  })
})

describe('builderLinkedCollectionUrl', () => {
  it("points at the legacy builder's linked collection page", () => {
    expect(builderLinkedCollectionUrl('c1')).toMatch(/\/builder\/thirdPartyCollections\/c1$/)
  })
})

describe('getLinkedItemStatus', () => {
  it.each([
    [CurationStatus.APPROVED, LinkedItemStatus.PUBLISHED],
    [CurationStatus.PENDING, LinkedItemStatus.UNDER_REVIEW],
    [CurationStatus.REJECTED, LinkedItemStatus.REJECTED],
    [undefined, LinkedItemStatus.NOT_PUBLISHED]
  ])('reads a %s item curation as %s', (curation, expected) => {
    expect(getLinkedItemStatus(curation)).toBe(expected)
  })
})

describe('summarizeMapping', () => {
  const mappingsFor = (...entries: unknown[]) => ({ amoy: { [CONTRACT]: entries } })

  it.each([
    ['any token', mappingsFor({ type: 'any' }), { kind: 'any' }],
    ['a single token', mappingsFor({ type: 'single', id: '7' }), { kind: 'single', id: '7' }],
    ['a range', mappingsFor({ type: 'range', from: '1', to: '50' }), { kind: 'range', from: '1', to: '50' }],
    ['a list of tokens', mappingsFor({ type: 'multiple', ids: ['1', '4', '9'] }), { kind: 'multiple', count: 3 }],
    ['several rules', mappingsFor({ type: 'single', id: '1' }, { type: 'any' }), { kind: 'rules', count: 2 }]
  ])('summarizes %s', (_, mappings, expected) => {
    expect(summarizeMapping(mappings, 'amoy', CONTRACT)).toEqual(expected)
  })

  it('matches the contract address case-insensitively', () => {
    expect(summarizeMapping(mappingsFor({ type: 'any' }), 'amoy', CONTRACT.toUpperCase())).toEqual({ kind: 'any' })
  })

  it('has no mapping when the item maps another contract or nothing at all', () => {
    expect(summarizeMapping(mappingsFor({ type: 'any' }), 'sepolia', CONTRACT)).toEqual({ kind: 'none' })
    expect(summarizeMapping(null, 'amoy', CONTRACT)).toEqual({ kind: 'none' })
  })
})
