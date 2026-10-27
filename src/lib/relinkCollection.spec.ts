import { describe, expect, it, vi } from 'vitest'
import { type ContractNetwork } from '@dcl/schemas'
import { type Collection } from './collections'
import { type Item } from './items'
import { MappingType, buildItemMappings } from './mappings'
import { loadRelinkFrom, relinkCollection, storeRelinkFrom, type RelinkDeps } from './relinkCollection'
import { type ThirdParty } from './thirdParty'

const CHAIN_ID = 80002
const OLD = { network: 'mainnet' as ContractNetwork, address: '0x' + 'a'.repeat(40) }
const NEW = { network: 'mainnet' as ContractNetwork, address: '0x' + 'b'.repeat(40) }
const SIBLING = { network: 'mainnet' as ContractNetwork, address: '0x' + 'c'.repeat(40) }

const collection = {
  id: 'col',
  urn: 'urn:decentraland:amoy:collections-thirdparty:brand:hats',
  linkedContractAddress: OLD.address,
  linkedContractNetwork: OLD.network
} as Collection

const thirdParty = {
  id: 'urn:decentraland:amoy:collections-thirdparty:brand',
  name: 'Brand',
  description: '',
  contracts: [OLD],
  published: true
} as ThirdParty

function item(id: string, contract = OLD): Item {
  return { id, mappings: buildItemMappings({ type: MappingType.SINGLE, id: '1' }, contract) } as Item
}

function deps(overrides: Partial<RelinkDeps> = {}) {
  const steps: string[] = []
  const d: RelinkDeps = {
    saveCollection: vi.fn(async c => c),
    fetchRegisteredContracts: vi.fn(async () => [SIBLING, OLD]),
    sendTransaction: vi.fn(async () => '0xtx'),
    settleTransaction: vi.fn(async () => 'mined' as const),
    fetchItems: vi.fn(async () => [item('a'), item('b'), { id: 'unmapped', mappings: null } as Item]),
    saveItem: vi.fn(async (i, patch) => ({ ...i, ...patch })),
    onStep: step => steps.push(step),
    ...overrides
  }
  return { d, steps }
}

const params = { chainId: CHAIN_ID, collection, thirdParty, from: OLD, to: NEW }

describe('relinkCollection', () => {
  it('saves the collection before touching the chain, swaps only the old contract on the registry and moves every mapped item', async () => {
    const { d, steps } = deps()
    const order: string[] = []
    vi.mocked(d.saveCollection).mockImplementation(async c => (order.push('save'), c))
    vi.mocked(d.sendTransaction).mockImplementation(async () => (order.push('tx'), '0xtx'))

    const result = await relinkCollection(d, params)

    expect(order).toEqual(['save', 'tx'])
    expect(steps).toEqual(['collection', 'tx', 'items'])
    expect(d.saveCollection).toHaveBeenCalledWith(
      expect.objectContaining({ linkedContractAddress: NEW.address, linkedContractNetwork: NEW.network })
    )
    const call = vi.mocked(d.sendTransaction).mock.calls[0][0]
    const [[, metadata]] = call.args[0] as [string, string][]
    expect(metadata).toBe(`tp:1:Brand::mainnet-${SIBLING.address};mainnet-${NEW.address}`)
    expect(d.saveItem).toHaveBeenCalledTimes(2)
    expect(vi.mocked(d.saveItem).mock.calls[0][1]).toEqual({
      mappings: buildItemMappings({ type: MappingType.SINGLE, id: '1' }, NEW)
    })
    expect(result).toEqual({ moved: 2 })
  })

  it('does not reach the chain when the server refuses the contract', async () => {
    const { d } = deps({ saveCollection: vi.fn(async () => Promise.reject(new Error('in use'))) })
    await expect(relinkCollection(d, params)).rejects.toThrow('in use')
    expect(d.sendTransaction).not.toHaveBeenCalled()
    expect(d.saveItem).not.toHaveBeenCalled()
  })

  it('finishes a run that stopped halfway without a second signature or re-saving moved items', async () => {
    const { d, steps } = deps({
      fetchRegisteredContracts: vi.fn(async () => [SIBLING, NEW]),
      fetchItems: vi.fn(async () => [item('moved', NEW), item('left', OLD)])
    })
    const saved = { ...collection, linkedContractAddress: NEW.address, linkedContractNetwork: NEW.network }

    const result = await relinkCollection(d, { ...params, collection: saved })

    expect(d.saveCollection).not.toHaveBeenCalled()
    expect(d.sendTransaction).not.toHaveBeenCalled()
    expect(steps).toEqual(['tx', 'items'])
    expect(d.saveItem).toHaveBeenCalledTimes(1)
    expect(vi.mocked(d.saveItem).mock.calls[0][0].id).toBe('left')
    expect(result).toEqual({ moved: 1 })
  })

  it('accepts a replaced transaction once the registry shows the contract, and fails when it does not', async () => {
    const { d } = deps({
      settleTransaction: vi.fn(async () => 'dropped' as const),
      fetchRegisteredContracts: vi.fn().mockResolvedValueOnce([OLD]).mockResolvedValueOnce([NEW])
    })
    await expect(relinkCollection(d, params)).resolves.toEqual({ moved: 2 })

    const failing = deps({
      settleTransaction: vi.fn(async () => 'dropped' as const),
      fetchRegisteredContracts: vi.fn(async () => [OLD])
    })
    await expect(relinkCollection(failing.d, params)).rejects.toThrow('dropped')
    expect(failing.d.saveItem).not.toHaveBeenCalled()
  })

  it('refuses to rewrite a registry record it could not read', async () => {
    const { d } = deps({ fetchRegisteredContracts: vi.fn(async () => []) })
    await expect(relinkCollection(d, params)).rejects.toThrow('could not be parsed')
    expect(d.sendTransaction).not.toHaveBeenCalled()
  })

  it('skips the chain for a third party that is not registered yet', async () => {
    const { d, steps } = deps()
    await relinkCollection(d, { ...params, thirdParty: { ...thirdParty, published: false } })
    expect(d.fetchRegisteredContracts).not.toHaveBeenCalled()
    expect(d.sendTransaction).not.toHaveBeenCalled()
    expect(steps).toEqual(['collection', 'items'])
  })
})

describe('loadRelinkFrom / storeRelinkFrom', () => {
  it('remembers the contract a relink started from until it is cleared', () => {
    expect(loadRelinkFrom('col')).toBeNull()
    storeRelinkFrom('col', OLD)
    expect(loadRelinkFrom('col')).toEqual(OLD)
    storeRelinkFrom('col', null)
    expect(loadRelinkFrom('col')).toBeNull()
  })
})
