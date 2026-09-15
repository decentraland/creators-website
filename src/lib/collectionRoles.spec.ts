import { describe, expect, it } from 'vitest'
import { ContractName, getContract } from 'decentraland-transactions'
import { encodeContractCall } from './auth/transactions'
import { type Collection } from './collections'
import {
  buildSetRolesCall,
  diffRoles,
  getRoleAddressError,
  getRoleAddresses,
  isCollectionOwner,
  withRoles
} from './collectionRoles'

const OWNER = '0x00000000000000000000000000000000000000aa'
const MINTER = '0x00000000000000000000000000000000000000bb'
const MANAGER = '0x00000000000000000000000000000000000000cc'
const OTHER = '0x00000000000000000000000000000000000000dd'
const CONTRACT = '0x00000000000000000000000000000000000000ee'
const CHAIN_ID = 80002
const MARKETPLACE = getContract(ContractName.OffChainMarketplaceV2, CHAIN_ID).address
const STORE = getContract(ContractName.CollectionStore, CHAIN_ID).address

const collection: Collection = {
  id: 'c1',
  name: 'Hats',
  owner: OWNER,
  urn: `urn:decentraland:amoy:collections-v2:${CONTRACT}`,
  contractAddress: CONTRACT,
  isPublished: true,
  isApproved: true,
  itemCount: 2,
  minters: [MINTER.toUpperCase(), MARKETPLACE, STORE.toUpperCase(), MINTER],
  managers: [MANAGER],
  createdAt: 1,
  updatedAt: 1
}

describe('role lists', () => {
  it('lists senders without the sale contracts, lowercased and without repeats', () => {
    expect(getRoleAddresses(collection, 'senders', CHAIN_ID)).toEqual([MINTER])
    expect(getRoleAddresses(collection, 'collaborators', CHAIN_ID)).toEqual([MANAGER])
  })

  it('recognises the owner regardless of casing', () => {
    expect(isCollectionOwner(collection, OWNER.toUpperCase())).toBe(true)
    expect(isCollectionOwner(collection, OTHER)).toBe(false)
    expect(isCollectionOwner(collection, undefined)).toBe(false)
  })

  it('refuses the owner, an address already listed and the sale contracts', () => {
    const current = [MINTER]
    expect(getRoleAddressError(collection, 'senders', current, OWNER, CHAIN_ID)).toBe('owner')
    expect(getRoleAddressError(collection, 'senders', current, MINTER.toUpperCase(), CHAIN_ID)).toBe('duplicate')
    expect(getRoleAddressError(collection, 'senders', current, MARKETPLACE, CHAIN_ID)).toBe('system')
    expect(getRoleAddressError(collection, 'collaborators', current, MARKETPLACE, CHAIN_ID)).toBeNull()
    expect(getRoleAddressError(collection, 'senders', current, OTHER, CHAIN_ID)).toBeNull()
  })
})

describe('saving roles', () => {
  it('sends only the changes: removals as false, additions as true', () => {
    expect(diffRoles([MINTER, MANAGER], [MANAGER, OTHER])).toEqual({
      addresses: [MINTER, OTHER],
      values: [false, true]
    })
    expect(diffRoles([MINTER], [MINTER]).addresses).toEqual([])
  })

  it('encodes setMinters / setManagers on the collection contract', () => {
    const diff = diffRoles([MINTER], [OTHER])
    const senders = buildSetRolesCall(collection, 'senders', diff, CHAIN_ID)
    expect(senders.contract.address).toBe(CONTRACT)
    expect(senders.method).toBe('setMinters')
    expect(senders.args).toEqual([
      [MINTER, OTHER],
      [false, true]
    ])
    expect(encodeContractCall(senders)).toMatch(/^0x[0-9a-f]+$/)

    const collaborators = buildSetRolesCall(collection, 'collaborators', diff, CHAIN_ID)
    expect(collaborators.method).toBe('setManagers')
    expect(encodeContractCall(collaborators)).toMatch(/^0x[0-9a-f]+$/)
  })

  it('refuses a collection without a contract', () => {
    expect(() =>
      buildSetRolesCall({ ...collection, contractAddress: undefined }, 'senders', diffRoles([], [OTHER]), CHAIN_ID)
    ).toThrow(/no contract/)
  })

  it('patches the collection keeping the sale contracts among the minters', () => {
    const patched = withRoles(collection, 'senders', [OTHER], CHAIN_ID)
    expect(patched.minters).toEqual([MARKETPLACE, STORE.toUpperCase(), OTHER])
    expect(withRoles(collection, 'collaborators', [], CHAIN_ID).managers).toEqual([])
  })
})
