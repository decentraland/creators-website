import { describe, expect, it, vi } from 'vitest'
import { getPublicationFee } from './publishFee'
import { type BlockchainRarity } from './rarities'
import { PublicationFeeMismatchError, isWithinFeeTolerance, verifyPublicationFee } from './feeVerification'

const ETHER = 10n ** 18n
const CHAIN_ID = 80002
// $5 per item, 500 MANA at the quoted oracle rate.
const RARITIES: BlockchainRarity[] = [
  {
    id: 'common',
    name: 'common',
    price: '5',
    maxSupply: '100000',
    prices: { USD: '5', MANA: (500n * ETHER).toString() }
  }
]
const items = [{ rarity: 'common' }, { rarity: 'common' }, { rarity: 'epic' }]
const fee = getPublicationFee(RARITIES, items.length)!

describe('verifyPublicationFee', () => {
  it('accepts a quote the contract would charge, allowing for oracle drift', async () => {
    const read = vi.fn().mockResolvedValue(500n * ETHER)
    await expect(verifyPublicationFee(fee, items, CHAIN_ID, read)).resolves.toBeUndefined()
    expect(read).toHaveBeenCalledTimes(2)
    expect(read).toHaveBeenCalledWith('common', CHAIN_ID)
    expect(read).toHaveBeenCalledWith('epic', CHAIN_ID)

    const drifted = vi.fn().mockResolvedValue(515n * ETHER)
    await expect(verifyPublicationFee(fee, items, CHAIN_ID, drifted)).resolves.toBeUndefined()
  })

  it('refuses a quote that is not what the contract charges', async () => {
    const cheaper = vi.fn().mockResolvedValue(700n * ETHER)
    await expect(verifyPublicationFee(fee, items, CHAIN_ID, cheaper)).rejects.toBeInstanceOf(
      PublicationFeeMismatchError
    )
    const overQuoted = vi.fn().mockResolvedValue(100n * ETHER)
    await expect(verifyPublicationFee(fee, items, CHAIN_ID, overQuoted)).rejects.toMatchObject({
      quotedWei: 1500n * ETHER,
      onChainWei: 300n * ETHER
    })
    const free = vi.fn().mockResolvedValue(0n)
    await expect(verifyPublicationFee(fee, items, CHAIN_ID, free)).rejects.toBeInstanceOf(PublicationFeeMismatchError)
  })

  it('treats a free fee as matching a free contract', () => {
    expect(isWithinFeeTolerance(0n, 0n)).toBe(true)
    expect(isWithinFeeTolerance(1n, 0n)).toBe(false)
    expect(isWithinFeeTolerance(1050n, 1000n)).toBe(true)
    expect(isWithinFeeTolerance(1051n, 1000n)).toBe(false)
  })
})
