import { describe, expect, it } from 'vitest'
import { ethers } from 'ethers'
import { ContractName, getContract } from 'decentraland-transactions'
import { type Collection } from './collections'
import { buildRescueItemsCalls, buildSetApprovedCall, RESCUE_CHUNK_SIZE } from './collectionApproval'

const CHAIN_ID = 80002
const collection = { id: 'c1', contractAddress: '0x' + '1'.repeat(40) } as Collection
const collectionAbi = new ethers.utils.Interface(getContract(ContractName.ERC721CollectionV2, CHAIN_ID).abi)

function innerCall(call: ReturnType<typeof buildSetApprovedCall>) {
  const [, , target, data] = call.args as [string, string, string, string[]]
  return { target, decoded: collectionAbi.parseTransaction({ data: data[0] }) }
}

describe('buildSetApprovedCall', () => {
  it('routes setApproved through the committee contract', () => {
    const call = buildSetApprovedCall(CHAIN_ID, collection, false)
    expect(call.contract.address).toBe(getContract(ContractName.Committee, CHAIN_ID).address)
    expect(call.method).toBe('manageCollection')
    const { target, decoded } = innerCall(call)
    expect(target).toBe(collection.contractAddress)
    expect(decoded.name).toBe('setApproved')
    expect(decoded.args[0]).toBe(false)
  })

  it('refuses a collection without a contract', () => {
    expect(() => buildSetApprovedCall(CHAIN_ID, { id: 'x' } as Collection, true)).toThrow()
  })
})

describe('buildRescueItemsCalls', () => {
  it('splits the items into chunks and keeps each item aligned with its hash and metadata', () => {
    const entries = Array.from({ length: RESCUE_CHUNK_SIZE + 2 }, (_, i) => ({
      tokenId: String(i),
      contentHash: `hash${i}`,
      metadata: `meta${i}`
    }))
    const calls = buildRescueItemsCalls(CHAIN_ID, collection, entries)
    expect(calls).toHaveLength(2)
    const { decoded } = innerCall(calls[1])
    expect(decoded.name).toBe('rescueItems')
    expect(decoded.args[0].map(String)).toEqual([String(RESCUE_CHUNK_SIZE), String(RESCUE_CHUNK_SIZE + 1)])
    expect(decoded.args[1]).toEqual([`hash${RESCUE_CHUNK_SIZE}`, `hash${RESCUE_CHUNK_SIZE + 1}`])
    expect(decoded.args[2]).toEqual([`meta${RESCUE_CHUNK_SIZE}`, `meta${RESCUE_CHUNK_SIZE + 1}`])
  })
})
