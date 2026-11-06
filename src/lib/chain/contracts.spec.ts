import { describe, expect, it } from 'vitest'
import { formatAbiItem } from 'abitype'
import { type Abi } from 'viem'
import * as pkg from 'decentraland-transactions'
import {
  ContractName,
  getCollectionContract,
  getContract,
  getCouponManager,
  getMarketplaceName,
  type ContractData
} from './contracts'

const CHAINS = [1, 11155111, 137, 80002]
const NAMES = Object.values(ContractName)

type PackageContract = { address: string; name: string; version: string; chainId: number; abi: object[] }

function packageContract(name: string, chainId: number): PackageContract | undefined {
  try {
    return pkg.getContract(name as pkg.ContractName, chainId)
  } catch {
    return undefined
  }
}

function registryContract(name: ContractName, chainId: number): ContractData | undefined {
  try {
    return getContract(name, chainId)
  } catch {
    return undefined
  }
}

function packageStyle(abi: object[]) {
  const execute = (abi as { name?: string; inputs?: { name: string }[] }[]).find(
    item => item.name === 'executeMetaTransaction'
  )
  if (!execute) return undefined
  return execute.inputs?.some(input => input.name === '_functionData') ? 'functionData' : 'functionSignature'
}

const functions = (abi: Abi | object[]) =>
  (abi as Abi).filter(item => item.type === 'function').map(item => formatAbiItem(item))

describe('the contract registry', () => {
  it.each(NAMES.flatMap(name => CHAINS.map(chainId => [name, chainId] as const)))(
    'should hold what decentraland-transactions holds for %s on chain %i',
    (name, chainId) => {
      const expected = packageContract(name, chainId)
      const actual = registryContract(name, chainId)
      if (!expected) return expect(actual).toBeUndefined()
      expect(actual && { ...actual, abi: undefined }).toEqual({
        address: expected.address,
        name: expected.name,
        version: expected.version,
        chainId: expected.chainId,
        abi: undefined,
        metaTransaction: packageStyle(expected.abi)
      })
    }
  )

  it.each(NAMES)("should only declare functions %s's package ABI has, outputs and names included", name => {
    const known = new Set(CHAINS.flatMap(chainId => functions(packageContract(name, chainId)?.abi ?? [])))
    const declared = functions(CHAINS.map(chainId => registryContract(name, chainId)).find(Boolean)!.abi)
    expect(declared.filter(signature => !known.has(signature))).toEqual([])
  })

  it.each(CHAINS)('should describe a collection contract as the package does on chain %i', chainId => {
    const expected = packageContract('ERC721CollectionV2', chainId)
    const collection = '0x00000000000000000000000000000000000000ee'
    if (!expected) return expect(() => getCollectionContract(chainId, collection)).toThrow()
    const actual = getCollectionContract(chainId, collection)
    expect({ ...actual, abi: undefined }).toEqual({
      address: collection,
      name: expected.name,
      version: expected.version,
      chainId: expected.chainId,
      abi: undefined,
      metaTransaction: packageStyle(expected.abi)
    })
    const known = new Set(functions(expected.abi))
    expect(functions(actual.abi).filter(signature => !known.has(signature))).toEqual([])
  })

  it('should resolve every known address to the marketplace the package resolves it to', () => {
    const addresses = NAMES.flatMap(name => CHAINS.map(chainId => registryContract(name, chainId)?.address ?? ''))
    for (const address of addresses.filter(Boolean)) {
      const name = pkg.getContractName(address)
      const marketplace = name.startsWith('OffChainMarketplace') ? name : undefined
      expect(getMarketplaceName(address), address).toBe(marketplace)
    }
  })

  it.each(
    (['OffChainMarketplace', 'OffChainMarketplaceV2', 'OffChainMarketplaceV3'] as const).flatMap(name =>
      CHAINS.map(chainId => [name, chainId] as const)
    )
  )('should pair %s on chain %i with the coupon manager the package pairs it with', (marketplace, chainId) => {
    let expected: string | undefined
    try {
      expected = pkg.getCouponManager(marketplace as pkg.ContractName, chainId).address
    } catch {
      expected = undefined
    }
    let actual: string | undefined
    try {
      actual = getCouponManager(marketplace, chainId).address
    } catch {
      actual = undefined
    }
    expect(actual).toBe(expected)
  })
})
