import { describe, expect, it } from 'vitest'
import { encodeContractCall } from './auth/transactions'
import { type Collection } from './collections'
import { buildTransferOwnershipCall, getNewOwnerError, matchesCollectionName, withOwner } from './collectionOwnership'

const OWNER = '0x00000000000000000000000000000000000000aa'
const OTHER = '0x00000000000000000000000000000000000000dd'
const CONTRACT = '0x00000000000000000000000000000000000000ee'
const CHAIN_ID = 80002

const collection: Collection = {
  id: 'c1',
  name: 'Pirate Hats',
  owner: OWNER,
  urn: `urn:decentraland:amoy:collections-v2:${CONTRACT}`,
  contractAddress: CONTRACT,
  isPublished: true,
  isApproved: true,
  itemCount: 2,
  minters: [],
  managers: [],
  createdAt: 1,
  updatedAt: 1
}

describe('choosing the new owner', () => {
  it("refuses the owner's own address and accepts anyone else", () => {
    expect(getNewOwnerError(collection, OWNER.toUpperCase())).toBe('self')
    expect(getNewOwnerError(collection, OTHER)).toBeNull()
  })

  it('matches the typed confirmation to the collection name, ignoring case and surrounding spaces', () => {
    expect(matchesCollectionName(collection, '  pirate hats ')).toBe(true)
    expect(matchesCollectionName(collection, 'Pirate Hat')).toBe(false)
    expect(matchesCollectionName(collection, '')).toBe(false)
  })
})

describe('transferring', () => {
  it('calls transferCreatorship on the collection contract', () => {
    const call = buildTransferOwnershipCall(collection, OTHER, CHAIN_ID)
    expect(call.contract.address).toBe(CONTRACT)
    expect(call.method).toBe('transferCreatorship')
    expect(call.args).toEqual([OTHER])
    expect(encodeContractCall(call)).toMatch(/^0x[0-9a-f]+$/)
  })

  it('refuses a collection without a contract', () => {
    expect(() => buildTransferOwnershipCall({ ...collection, contractAddress: undefined }, OTHER, CHAIN_ID)).toThrow(
      /not_published|contract/
    )
  })

  it('patches the owner, lowercased, leaving the roles alone', () => {
    const roles = { ...collection, minters: ['0xM'], managers: ['0xG'] }
    expect(withOwner(roles, OTHER.toUpperCase())).toEqual({ ...roles, owner: OTHER })
  })
})
