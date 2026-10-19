import { describe, expect, it, vi } from 'vitest'
import { ethers } from 'ethers'
import { type ContractNetwork } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import { readContract } from '~/lib/auth'
import { encodeContractCall } from './auth/transactions'
import { type ThirdParty } from './thirdParty'
import {
  buildAddThirdPartyCall,
  buildBuyItemSlotsCall,
  buildReviewThirdPartyCall,
  buildReviewThirdPartyWithRootCall,
  fetchThirdPartyPrice,
  getThirdPartyRegistry,
  toChequeSlot,
  usdToMana
} from './thirdPartyRegistry'

vi.mock('~/lib/auth', () => ({ readContract: vi.fn() }))

const CHAIN_ID = 80002
const ETHER = 10n ** 18n
const MANAGER = '0x00000000000000000000000000000000000000aa'
const THIRD_PARTY_ID = 'urn:decentraland:amoy:collections-thirdparty:brand'
const REGISTRY = getThirdPartyRegistry(CHAIN_ID)

const thirdParty: ThirdParty = {
  id: THIRD_PARTY_ID,
  root: '',
  managers: [MANAGER],
  name: 'Brand',
  description: 'A brand',
  isApproved: false,
  isProgrammatic: false,
  maxItems: '0',
  contracts: [{ network: 'amoy' as ContractNetwork, address: '0x' + '1'.repeat(40) }],
  published: false
}

/** Encodes the call with the registry ABI and decodes it back: proves the args fit the contract's signature. */
function roundTrip(call: ReturnType<typeof buildBuyItemSlotsCall>) {
  expect(call.contract.address).toBe(REGISTRY.address)
  return new ethers.utils.Interface(call.contract.abi).decodeFunctionData(call.method, encodeContractCall(call))
}

describe('buildAddThirdPartyCall', () => {
  it('registers the third party with its raw metadata, enabled managers, slots, kind and price cap', () => {
    const call = buildAddThirdPartyCall(CHAIN_ID, { ...thirdParty, isProgrammatic: true }, 200, 603n * ETHER)

    expect(call.method).toBe('addThirdParties')
    const [parties, programmatic, maxPrices] = roundTrip(call)
    expect(parties).toHaveLength(1)
    const [id, metadata, resolver, managers, enabled, slots] = parties[0]
    expect(id).toBe(THIRD_PARTY_ID)
    expect(metadata).toBe(`tp:1:Brand:A brand:amoy-${'0x' + '1'.repeat(40)}`)
    expect(resolver).toBe('Disabled')
    expect(managers.map((manager: string) => manager.toLowerCase())).toEqual([MANAGER])
    expect(enabled).toEqual([true])
    expect(slots.toString()).toBe('200')
    expect(programmatic).toEqual([true])
    expect(maxPrices.map((value: ethers.BigNumber) => BigInt(value.toString()))).toEqual([603n * ETHER])
  })

  it('enables every manager', () => {
    const other = '0x00000000000000000000000000000000000000bb'
    const call = buildAddThirdPartyCall(CHAIN_ID, { ...thirdParty, managers: [MANAGER, other] }, 1, ETHER)
    const [parties] = roundTrip(call)
    expect(parties[0][3]).toHaveLength(2)
    expect(parties[0][4]).toEqual([true, true])
  })
})

describe('buildBuyItemSlotsCall', () => {
  it('buys the slots for the third party under the price cap', () => {
    const call = buildBuyItemSlotsCall(CHAIN_ID, THIRD_PARTY_ID, 3, 603n * ETHER)

    expect(call.method).toBe('buyItemSlots')
    const [id, qty, maxPrice] = roundTrip(call)
    expect(id).toBe(THIRD_PARTY_ID)
    expect(qty.toString()).toBe('3')
    expect(BigInt(maxPrice.toString())).toBe(603n * ETHER)
  })
})

describe('toChequeSlot', () => {
  it('splits the cheque into the tuple the registry consumes', async () => {
    const wallet = ethers.Wallet.createRandom()
    const salt = '0x' + '11'.repeat(32)
    const signature = await wallet.signMessage('cheque')
    const { r, s, v } = ethers.utils.splitSignature(signature)

    expect(toChequeSlot({ signature, qty: 7, salt })).toEqual(['7', salt, r, s, v])
  })
})

describe('buildReviewThirdPartyWithRootCall', () => {
  it('sets the root and consumes the cheques', async () => {
    const wallet = ethers.Wallet.createRandom()
    const salt = '0x' + '11'.repeat(32)
    const root = '0x' + '22'.repeat(32)
    const slot = toChequeSlot({ signature: await wallet.signMessage('cheque'), qty: 7, salt })

    const call = buildReviewThirdPartyWithRootCall(CHAIN_ID, THIRD_PARTY_ID, root, [slot])

    expect(call.method).toBe('reviewThirdPartyWithRoot')
    const [id, decodedRoot, slots] = roundTrip(call)
    expect(id).toBe(THIRD_PARTY_ID)
    expect(decodedRoot).toBe(root)
    expect(slots).toHaveLength(1)
    expect(slots[0][0].toString()).toBe('7')
    expect(slots[0][1]).toBe(salt)
    expect(slots[0][4]).toBe(slot[4])
  })

  it('accepts no cheques when they were already consumed', () => {
    const call = buildReviewThirdPartyWithRootCall(CHAIN_ID, THIRD_PARTY_ID, '0x' + '22'.repeat(32), [])
    const [, , slots] = roundTrip(call)
    expect(slots).toEqual([])
  })
})

describe('buildReviewThirdPartyCall', () => {
  it('enables or disables the whole third party', () => {
    const call = buildReviewThirdPartyCall(CHAIN_ID, THIRD_PARTY_ID, false)

    expect(call.method).toBe('reviewThirdParties')
    const [reviews] = roundTrip(call)
    expect(reviews).toHaveLength(1)
    expect(reviews[0][0]).toBe(THIRD_PARTY_ID)
    expect(reviews[0][1]).toBe(false)
  })
})

describe('usdToMana', () => {
  it('converts a USD price to MANA at the oracle rate (USD per MANA)', () => {
    expect(usdToMana(100n * ETHER, ETHER / 2n)).toBe(200n * ETHER)
    expect(usdToMana(ETHER, (3n * ETHER) / 10n)).toBe(3333333333333333333n)
    expect(usdToMana(0n, ETHER)).toBe(0n)
  })

  it('answers zero rather than dividing by a zero rate', () => {
    expect(usdToMana(ETHER, 0n)).toBe(0n)
  })
})

describe('fetchThirdPartyPrice', () => {
  it('reads the slot price, the programmatic pack and the oracle rate, and prices a slot in MANA', async () => {
    const oracle = getContract(ContractName.ChainlinkOracle, CHAIN_ID)
    vi.mocked(readContract).mockImplementation(async (contract, method) => {
      if (contract.address === REGISTRY.address && method === 'itemSlotPrice') {
        return ethers.BigNumber.from((100n * ETHER).toString())
      }
      if (contract.address === REGISTRY.address && method === 'programmaticBasePurchasedSlots') {
        return ethers.BigNumber.from(200)
      }
      if (contract.address === oracle.address && method === 'getRate') {
        return ethers.BigNumber.from((ETHER / 2n).toString())
      }
      throw new Error(`Unexpected read ${method}`)
    })

    await expect(fetchThirdPartyPrice(CHAIN_ID)).resolves.toEqual({
      itemSlotUsdWei: 100n * ETHER,
      itemSlotManaWei: 200n * ETHER,
      programmaticMinSlots: 200,
      manaPerUsdWei: ETHER / 2n
    })
  })
})
