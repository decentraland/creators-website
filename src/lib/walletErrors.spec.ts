import { describe, it, expect } from 'vitest'
import { isWalletRejection } from './walletErrors'

describe('isWalletRejection', () => {
  it('recognizes the EIP-1193 code, the ethers code and wallet wording', () => {
    expect(isWalletRejection({ code: 4001, message: 'x' })).toBe(true)
    expect(isWalletRejection(Object.assign(new Error('boom'), { code: 'ACTION_REJECTED' }))).toBe(true)
    expect(isWalletRejection(new Error('MetaMask Tx Signature: User denied transaction signature.'))).toBe(true)
  })

  it('leaves other failures alone', () => {
    expect(isWalletRejection(new Error('insufficient funds'))).toBe(false)
    expect(isWalletRejection('nope')).toBe(false)
  })
})
