import { describe, expect, it } from 'vitest'
import { ContractName, getContract } from 'decentraland-transactions'
import { discountReach, discountedCredits, discountedManaWei, takesDiscount } from './collectionDiscount'
import { type ItemListing } from './listings'

const CHAIN_ID = 80002
const V3 = getContract(ContractName.OffChainMarketplaceV3, CHAIN_ID).address.toLowerCase()
const V2 = getContract(ContractName.OffChainMarketplaceV2, CHAIN_ID).address.toLowerCase()
const MANA = 10n ** 18n

const credits = (itemId: string, amount: number, tradeContract = V3): ItemListing => ({
  itemId,
  tradeId: `t-${itemId}`,
  tradeContract,
  currency: 'credits',
  credits: amount
})
const manaTrade = (itemId: string, manaWei: bigint, tradeContract = V3): ItemListing => ({
  itemId,
  tradeId: `t-${itemId}`,
  tradeContract,
  currency: 'mana',
  manaWei
})
// A collection-store price: bought through CollectionStore, which takes no coupon.
const storePrice = (itemId: string): ItemListing => ({ itemId, currency: 'mana', manaWei: 10n * MANA })

const off = { chainId: CHAIN_ID, manaListings: false }
const on = { chainId: CHAIN_ID, manaListings: true }

describe('when deciding whether a new discount re-prices a listing', () => {
  it('should discount a credits listing on the current marketplace', () => {
    expect(takesDiscount(credits('0', 50), off)).toBe(true)
  })

  it('should discount a MANA listing only while the Shop discounts MANA listings', () => {
    expect(takesDiscount(manaTrade('0', 10n * MANA), on)).toBe(true)
    expect(takesDiscount(manaTrade('0', 10n * MANA), off)).toBe(false)
  })

  // That marketplace redeems through another manager, so the coupon never reaches its checkout.
  it('should leave a listing on an older marketplace alone', () => {
    expect(takesDiscount(credits('0', 50, V2), on)).toBe(false)
    expect(takesDiscount(manaTrade('0', 10n * MANA, V2), on)).toBe(false)
  })

  it('should never discount a collection-store price or a giveaway', () => {
    expect(takesDiscount(storePrice('0'), on)).toBe(false)
    expect(takesDiscount(manaTrade('0', 0n), on)).toBe(false)
  })
})

describe("when summing up what a discount does to a collection's listings", () => {
  it('should count what it re-prices and what keeps its price', () => {
    const reach = discountReach([credits('0', 50), credits('1', 120), manaTrade('2', 30n * MANA), storePrice('3')], off)
    expect(reach).toEqual({ discounted: 2, unchanged: 2, example: { credits: 120 } })
  })

  it('should fall back to a MANA example when no credits listing takes it', () => {
    const reach = discountReach([manaTrade('0', 5n * MANA), manaTrade('1', 30n * MANA), storePrice('2')], on)
    expect(reach).toEqual({ discounted: 2, unchanged: 1, example: { manaWei: 30n * MANA } })
  })

  it('should have no example when nothing takes it', () => {
    expect(discountReach([storePrice('0')], on)).toEqual({ discounted: 0, unchanged: 1, example: null })
  })
})

describe('when pricing the example line', () => {
  it('should round a credits price up to a whole credit, never below one', () => {
    expect(discountedCredits(100, 30)).toBe(70)
    expect(discountedCredits(5, 30)).toBe(4)
    expect(discountedCredits(1, 70)).toBe(1)
  })

  it('should price MANA the way the contract does: price minus the floored cut', () => {
    expect(discountedManaWei(100n * MANA, 30)).toBe(70n * MANA)
    expect(discountedManaWei(7n, 30)).toBe(5n)
  })
})
