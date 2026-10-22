import { describe, it, expect } from 'vitest'
import { type ContractNetwork } from '@dcl/schemas'
import { type Item } from './items'
import { ItemFileError } from './itemFiles'
import { MappingType } from './mappings'
import { resolveLinkedManifest } from './linkedManifest'

const contract = { network: 'amoy' as ContractNetwork, address: '0x' + '1'.repeat(40) }
const collectionUrn = 'urn:decentraland:amoy:collections-thirdparty:brand:hats'
const target = { collectionUrn, contract }

function errorKey(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    return error instanceof ItemFileError ? error.messageKey : 'unexpected'
  }
  return undefined
}

describe('resolveLinkedManifest', () => {
  it('takes the URN suffix and the mapping the manifest sets', () => {
    expect(resolveLinkedManifest({ id: `${collectionUrn}:cap`, mapping: { type: 'single', id: '7' } }, target)).toEqual(
      { urnSuffix: 'cap', mapping: { type: MappingType.SINGLE, id: '7' } }
    )
  })

  it('defaults to every token and a generated URN when the manifest sets neither', () => {
    expect(resolveLinkedManifest(undefined, target)).toEqual({ urnSuffix: null, mapping: { type: MappingType.ANY } })
  })

  it("refuses another collection's URN and an invalid mapping", () => {
    expect(
      errorKey(() => resolveLinkedManifest({ id: 'urn:decentraland:amoy:collections-thirdparty:x:y:z' }, target))
    ).toBe('linked_urn_mismatch')
    expect(errorKey(() => resolveLinkedManifest({ mapping: { type: 'range', from: '9', to: '1' } }, target))).toBe(
      'linked_mapping_invalid'
    )
  })

  it('in bulk edit, needs an existing item and keeps its mapping when the zip sets none', () => {
    const existing = {
      urn: `${collectionUrn}:cap`,
      mappings: { amoy: { [contract.address]: [{ type: 'single', id: '3' }] } }
    } as unknown as Item
    const updating = { ...target, updating: new Map([[existing.urn!, existing]]) }

    expect(errorKey(() => resolveLinkedManifest({}, updating))).toBe('bulk_edit_missing_urn')
    expect(errorKey(() => resolveLinkedManifest({ id: `${collectionUrn}:boots` }, updating))).toBe('bulk_edit_no_match')
    expect(resolveLinkedManifest({ id: existing.urn }, updating).mapping).toEqual({ type: MappingType.SINGLE, id: '3' })
  })
})

describe('resolveLinkedManifest when adding items', () => {
  it('refuses a URN an item of the collection already has, so adding never overwrites it', () => {
    const adding = { ...target, takenUrns: new Set([`${collectionUrn}:cap`]) }
    expect(errorKey(() => resolveLinkedManifest({ id: `${collectionUrn}:cap` }, adding))).toBe('linked_urn_in_use')
    expect(resolveLinkedManifest({ id: `${collectionUrn}:boots` }, adding).urnSuffix).toBe('boots')
  })
})
