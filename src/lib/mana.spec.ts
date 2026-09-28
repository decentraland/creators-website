import { describe, expect, it } from 'vitest'
import { ethers } from 'ethers'
import { ContractName, getContract } from 'decentraland-transactions'
import { buildManaApproveCall, getManaContract } from './mana'

const CHAIN_ID = 80002
const SPENDER = getContract(ContractName.CollectionManager, CHAIN_ID).address

describe('buildManaApproveCall', () => {
  it('approves the spender for exactly the given amount, never an open-ended allowance', () => {
    const call = buildManaApproveCall(CHAIN_ID, SPENDER, 3000n * 10n ** 18n)
    expect(call.contract.address).toBe(getManaContract(CHAIN_ID).address)
    const decoded = new ethers.utils.Interface(call.contract.abi).decodeFunctionData(
      call.method,
      new ethers.utils.Interface(call.contract.abi).encodeFunctionData(call.method, call.args)
    )
    expect((decoded[0] as string).toLowerCase()).toBe(SPENDER.toLowerCase())
    expect(String(decoded[1])).toBe((3000n * 10n ** 18n).toString())
    expect(String(decoded[1])).not.toBe(ethers.constants.MaxUint256.toString())
  })

  it('refuses a zero or negative amount', () => {
    expect(() => buildManaApproveCall(CHAIN_ID, SPENDER, 0n)).toThrow()
  })
})
