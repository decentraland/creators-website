import { describe, expect, it, vi } from 'vitest'
import { ethers } from 'ethers'
import { Network, TradeAssetType, TradeType, type Trade } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import { encodeContractCall } from './auth/transactions'
import { TradeConflictError, TradeNotFoundError } from './trades'
import { type Collection } from './collections'
import { ItemType, type Item } from './items'
import {
  NO_EXPIRATION,
  SellItemError,
  buildCancelListingCall,
  buildEnableSalesCall,
  buildItemOrder,
  getListingTerms,
  removeListing,
  updatePrice,
  withConflictRetry,
  creditsToUsdWei,
  MAX_SALE_CREDITS,
  formatCreditsAsUsd,
  isValidCredits,
  formatDateValue,
  isSalesEnabled,
  isValidAddress,
  minExpirationDate,
  parseExpirationDate,
  sellItem,
  toSellItemError,
  withSalesEnabled,
  type SellItemDeps,
  type SellItemParams
} from './sales'

const CHAIN_ID = 80002
const ADDRESS = '0x00000000000000000000000000000000000000aa'
const BENEFICIARY = '0x00000000000000000000000000000000000000bb'
const CONTRACT = '0x00000000000000000000000000000000000000cc'
const MARKETPLACE_V2 = getContract(ContractName.OffChainMarketplaceV2, CHAIN_ID).address
const MARKETPLACE_V1 = getContract(ContractName.OffChainMarketplace, CHAIN_ID).address
const MANA = getContract(ContractName.MANAToken, CHAIN_ID).address
const SALT = '0x' + '11'.repeat(32)

const collection: Collection = {
  id: 'c1',
  name: 'Pirate Hats',
  owner: ADDRESS,
  urn: `urn:decentraland:amoy:collections-v2:${CONTRACT}`,
  contractAddress: CONTRACT,
  isPublished: true,
  isApproved: true,
  itemCount: 1,
  minters: [],
  managers: [],
  createdAt: 1,
  updatedAt: 1
}

const item: Item = {
  id: 'i1',
  name: 'Pirate Hat',
  description: 'Yarr',
  thumbnail: 'thumbnail.png',
  owner: ADDRESS,
  collectionId: 'c1',
  rarity: 'legendary',
  totalSupply: 10,
  tokenId: '3',
  isPublished: true,
  isApproved: true,
  inCatalyst: true,
  type: ItemType.WEARABLE,
  data: { category: 'hat', representations: [] },
  contents: {},
  createdAt: 1,
  updatedAt: 1
}

const params: SellItemParams = {
  address: ADDRESS,
  chainId: CHAIN_ID,
  collection,
  item,
  price: { kind: 'credits', credits: 50 },
  beneficiary: BENEFICIARY,
  expiresAt: NO_EXPIRATION
}
const indexes = { contractSignatureIndex: 1, signerSignatureIndex: 2 }

describe('price and date helpers', () => {
  it('converts whole credits to USD wei at ten cents a credit', () => {
    expect(creditsToUsdWei(1)).toBe('100000000000000000')
    expect(creditsToUsdWei(50)).toBe('5000000000000000000')
    expect(formatCreditsAsUsd(50)).toBe('$5.00')
    expect(formatCreditsAsUsd(1)).toBe('$0.10')
  })

  it('accepts whole credits from 1 up to the catalog ceiling', () => {
    expect(MAX_SALE_CREDITS).toBe(10_000_000_000_000n)
    expect(isValidCredits(1)).toBe(true)
    expect(isValidCredits(Number(MAX_SALE_CREDITS))).toBe(true)
    expect(isValidCredits(Number(MAX_SALE_CREDITS) + 1)).toBe(false)
    expect(isValidCredits(0)).toBe(false)
    expect(isValidCredits(1.5)).toBe(false)
  })

  it('validates wallet addresses', () => {
    expect(isValidAddress(BENEFICIARY)).toBe(true)
    expect(isValidAddress('0x123')).toBe(false)
    expect(isValidAddress('pirate.dcl.eth')).toBe(false)
  })

  it('expires at the end of the picked day, and only accepts dates from tomorrow on', () => {
    const now = new Date(2026, 8, 10, 12, 0, 0).getTime()
    expect(formatDateValue(minExpirationDate(now))).toBe('2026-09-11')
    const picked = parseExpirationDate('2026-09-11')!
    expect(new Date(picked).getHours()).toBe(23)
    expect(parseExpirationDate('09/11/2026')).toBeNull()
    expect(parseExpirationDate('')).toBeNull()
  })
})

describe('enabling sales', () => {
  it('is enabled once either off-chain marketplace is a minter, whatever the casing', () => {
    expect(isSalesEnabled(collection, CHAIN_ID)).toBe(false)
    expect(
      isSalesEnabled({ ...collection, minters: [MARKETPLACE_V2.toUpperCase().replace('0X', '0x')] }, CHAIN_ID)
    ).toBe(true)
    expect(isSalesEnabled({ ...collection, minters: [MARKETPLACE_V1] }, CHAIN_ID)).toBe(true)
    expect(isSalesEnabled({ ...collection, minters: ['0x00000000000000000000000000000000000000dd'] }, CHAIN_ID)).toBe(
      false
    )
  })

  it('builds setMinters([marketplace], [true]) on the collection contract', () => {
    const call = buildEnableSalesCall(collection, CHAIN_ID)
    expect(call.contract.address).toBe(CONTRACT)
    const iface = new ethers.utils.Interface(call.contract.abi)
    const decoded = iface.decodeFunctionData('setMinters', encodeContractCall(call))
    expect((decoded[0] as string[]).map(a => a.toLowerCase())).toEqual([MARKETPLACE_V2.toLowerCase()])
    expect(decoded[1]).toEqual([true])
  })

  it('refuses a collection without a contract', () => {
    expect(() => buildEnableSalesCall({ ...collection, contractAddress: undefined }, CHAIN_ID)).toThrow(SellItemError)
  })

  it('patches the minters the way the server will report them', () => {
    const enabled = withSalesEnabled(collection, CHAIN_ID)
    expect(isSalesEnabled(enabled, CHAIN_ID)).toBe(true)
    expect(withSalesEnabled(enabled, CHAIN_ID)).toBe(enabled)
  })
})

describe('buildItemOrder', () => {
  it('sells every remaining unit for USD-pegged MANA, paid to the beneficiary', () => {
    const order = buildItemOrder(params, indexes, SALT, 1000)
    expect(order).toEqual({
      signer: ADDRESS,
      network: Network.MATIC,
      chainId: CHAIN_ID,
      type: TradeType.PUBLIC_ITEM_ORDER,
      checks: {
        uses: 90,
        expiration: NO_EXPIRATION,
        effective: 1000,
        salt: SALT,
        contractSignatureIndex: 1,
        signerSignatureIndex: 2,
        allowedRoot: '0x',
        externalChecks: []
      },
      sent: [{ assetType: TradeAssetType.COLLECTION_ITEM, contractAddress: CONTRACT, itemId: '3', extra: '' }],
      received: [
        {
          assetType: TradeAssetType.USD_PEGGED_MANA,
          contractAddress: MANA,
          amount: '5000000000000000000',
          extra: '',
          beneficiary: BENEFICIARY
        }
      ]
    })
  })

  it('encodes a giveaway as zero MANA to nobody, the way the legacy builder does', () => {
    const order = buildItemOrder({ ...params, price: { kind: 'free' } }, indexes, SALT)
    expect(order.received).toEqual([
      {
        assetType: TradeAssetType.ERC20,
        contractAddress: MANA,
        amount: '0',
        extra: '',
        beneficiary: ethers.constants.AddressZero
      }
    ])
  })

  it('refuses unpublished and sold-out items', () => {
    expect(() => buildItemOrder({ ...params, item: { ...item, tokenId: undefined } }, indexes, SALT)).toThrow(
      expect.objectContaining({ reason: 'not_published' })
    )
    expect(() => buildItemOrder({ ...params, item: { ...item, totalSupply: 100 } }, indexes, SALT)).toThrow(
      expect.objectContaining({ reason: 'sold_out' })
    )
  })
})

describe('sellItem', () => {
  function makeDeps(overrides: Partial<SellItemDeps> = {}): SellItemDeps {
    return {
      fetchSignatureIndexes: vi.fn().mockResolvedValue(indexes),
      signTrade: vi.fn().mockResolvedValue('0xsignature'),
      createTrade: vi.fn().mockResolvedValue('trade-1'),
      onSigned: vi.fn(),
      ...overrides
    }
  }

  it('reads the indexes, signs the order, reports the signature and stores the order', async () => {
    const deps = makeDeps()
    const result = await sellItem(params, deps)

    expect(deps.fetchSignatureIndexes).toHaveBeenCalledWith(ADDRESS, CHAIN_ID)
    const signed = vi.mocked(deps.signTrade).mock.calls[0][0]
    expect(signed.checks).toMatchObject(indexes)
    expect(signed.checks.salt).toMatch(/^0x[0-9a-f]{64}$/)
    expect(deps.onSigned).toHaveBeenCalledTimes(1)
    expect(deps.createTrade).toHaveBeenCalledWith({ ...signed, signature: '0xsignature' })
    expect(result).toEqual({ itemId: '3', tradeId: 'trade-1', currency: 'credits', credits: 50 })
  })

  it('answers a free listing for a giveaway', async () => {
    const result = await sellItem({ ...params, price: { kind: 'free' } }, makeDeps())
    expect(result).toEqual({ itemId: '3', tradeId: 'trade-1', currency: 'mana', manaWei: 0n })
  })

  it('maps a dismissed wallet prompt to a rejection without storing anything', async () => {
    const deps = makeDeps({ signTrade: vi.fn().mockRejectedValue({ code: 4001, message: 'User rejected' }) })
    await expect(sellItem(params, deps)).rejects.toMatchObject({ reason: 'rejected' })
    expect(deps.onSigned).not.toHaveBeenCalled()
    expect(deps.createTrade).not.toHaveBeenCalled()
  })

  it('keeps the sequence errors and wraps anything else as generic', () => {
    expect(toSellItemError(new SellItemError('sold_out')).reason).toBe('sold_out')
    expect(toSellItemError(new Error('500')).reason).toBe('generic')
    expect(toSellItemError('ACTION_REJECTED')).toMatchObject({ reason: 'generic' })
  })
})

const storedTrade: Trade = {
  ...buildItemOrder(params, indexes, SALT, 1000),
  id: 'trade-1',
  signature: '0x' + 'ab'.repeat(65),
  createdAt: 1,
  contract: MARKETPLACE_V2
}

const REF = { tradeId: 'trade-1', contractAddress: CONTRACT, itemId: '3' }

describe('removing a listing', () => {
  it('cancels the stored order on the marketplace it was signed for', () => {
    const call = buildCancelListingCall(storedTrade)
    expect(call.contract.address).toBe(MARKETPLACE_V2)
    expect(call.method).toBe('cancelSignature')
    const iface = new ethers.utils.Interface(call.contract.abi)
    expect(() => iface.encodeFunctionData(call.method, call.args)).not.toThrow()
  })

  it('reads the order, sends the cancellation, reports the signature and waits for the receipt', async () => {
    const deps = {
      fetchTrade: vi.fn().mockResolvedValue(storedTrade),
      fetchItemTradeId: vi.fn().mockResolvedValue(null),
      sendTransaction: vi.fn().mockResolvedValue('0xhash'),
      waitForTransaction: vi.fn().mockResolvedValue(true),
      onSigned: vi.fn()
    }
    await removeListing(REF, deps)
    expect(deps.fetchTrade).toHaveBeenCalledWith('trade-1')
    expect(deps.sendTransaction.mock.calls[0][0]).toMatchObject({ method: 'cancelSignature' })
    expect(deps.onSigned).toHaveBeenCalledTimes(1)
    expect(deps.waitForTransaction).toHaveBeenCalledWith('0xhash')

    deps.waitForTransaction.mockResolvedValue(false)
    await expect(removeListing(REF, deps)).rejects.toMatchObject({ reason: 'generic' })
    deps.sendTransaction.mockRejectedValue({ code: 4001 })
    await expect(removeListing(REF, deps)).rejects.toMatchObject({ reason: 'rejected' })
  })
})

describe('a stale listing id', () => {
  const base = {
    sendTransaction: vi.fn().mockResolvedValue('0xhash'),
    waitForTransaction: vi.fn().mockResolvedValue(true)
  }

  it("falls back to the item's current order when the server retired the cached one", async () => {
    const fetchTrade = vi.fn(async (id: string) => {
      if (id === 'trade-1') throw new TradeNotFoundError(id)
      return { ...storedTrade, id }
    })
    const fetchItemTradeId = vi.fn().mockResolvedValue('trade-9')
    await removeListing(REF, { ...base, fetchTrade, fetchItemTradeId })
    expect(fetchItemTradeId).toHaveBeenCalledWith(CONTRACT, '3')
    expect(fetchTrade).toHaveBeenLastCalledWith('trade-9')
    expect(base.sendTransaction).toHaveBeenCalled()
  })

  it('reports an item that is no longer on sale instead of cancelling anything', async () => {
    const fetchTrade = vi.fn().mockRejectedValue(new TradeNotFoundError('trade-1'))
    await expect(
      removeListing(REF, {
        ...base,
        sendTransaction: vi.fn(),
        fetchTrade,
        fetchItemTradeId: vi.fn().mockResolvedValue(null)
      })
    ).rejects.toMatchObject({ reason: 'not_listed' })
  })
})

describe('updating the price', () => {
  it('keeps the beneficiary and expiration of the old order, paying the signer for a giveaway', () => {
    expect(getListingTerms(storedTrade, ADDRESS)).toEqual({ beneficiary: BENEFICIARY, expiresAt: NO_EXPIRATION })
    const free = buildItemOrder({ ...params, price: { kind: 'free' } }, indexes, SALT)
    expect(getListingTerms({ ...storedTrade, ...free }, ADDRESS).beneficiary).toBe(ADDRESS)
  })

  it('cancels the old order, then signs and stores a new one at the new price with the same terms', async () => {
    const deps = {
      fetchTrade: vi.fn().mockResolvedValue(storedTrade),
      fetchItemTradeId: vi.fn().mockResolvedValue(null),
      sendTransaction: vi.fn().mockResolvedValue('0xhash'),
      waitForTransaction: vi.fn().mockResolvedValue(true),
      fetchSignatureIndexes: vi.fn().mockResolvedValue(indexes),
      signTrade: vi.fn().mockResolvedValue('0xnewsig'),
      createTrade: vi.fn().mockResolvedValue('trade-2'),
      onSigned: vi.fn(),
      onCancelled: vi.fn()
    }
    const listing = await updatePrice(
      { address: ADDRESS, chainId: CHAIN_ID, collection, item, tradeId: 'trade-1', credits: 80 },
      deps
    )

    expect(deps.onSigned.mock.calls.map(c => c[0])).toEqual(['cancel', 'sign'])
    expect(deps.onCancelled).toHaveBeenCalledWith({ beneficiary: BENEFICIARY, expiresAt: NO_EXPIRATION })
    const signed = deps.signTrade.mock.calls[0][0]
    expect(signed.received[0]).toMatchObject({ amount: creditsToUsdWei(80), beneficiary: BENEFICIARY })
    expect(signed.checks.expiration).toBe(NO_EXPIRATION)
    expect(listing).toEqual({ itemId: '3', tradeId: 'trade-2', currency: 'credits', credits: 80 })
  })

  it('refuses a sold-out item before cancelling its order', async () => {
    const deps = {
      fetchTrade: vi.fn(),
      fetchItemTradeId: vi.fn(),
      sendTransaction: vi.fn(),
      waitForTransaction: vi.fn(),
      fetchSignatureIndexes: vi.fn(),
      signTrade: vi.fn(),
      createTrade: vi.fn()
    }
    await expect(
      updatePrice(
        {
          address: ADDRESS,
          chainId: CHAIN_ID,
          collection,
          item: { ...item, totalSupply: 100 },
          tradeId: 'trade-1',
          credits: 80
        },
        deps
      )
    ).rejects.toMatchObject({ reason: 'sold_out' })
    expect(deps.sendTransaction).not.toHaveBeenCalled()
  })

  it('stops before cancelling anything when the wallet prompt is dismissed', async () => {
    const deps = {
      fetchTrade: vi.fn().mockResolvedValue(storedTrade),
      fetchItemTradeId: vi.fn(),
      sendTransaction: vi.fn().mockRejectedValue({ code: 4001 }),
      waitForTransaction: vi.fn(),
      fetchSignatureIndexes: vi.fn(),
      signTrade: vi.fn(),
      createTrade: vi.fn(),
      onCancelled: vi.fn()
    }
    await expect(
      updatePrice({ address: ADDRESS, chainId: CHAIN_ID, collection, item, tradeId: 'trade-1', credits: 80 }, deps)
    ).rejects.toMatchObject({ reason: 'rejected' })
    expect(deps.onCancelled).not.toHaveBeenCalled()
    expect(deps.signTrade).not.toHaveBeenCalled()
  })
})

describe('withConflictRetry', () => {
  const conflict = new TradeConflictError('There is already an open order for this Item')

  it('re-posts the same signed order while the server still sees the old one, reporting each wait', async () => {
    const createTrade = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockResolvedValue('trade-2')
    const onIndexing = vi.fn()
    const wait = vi.fn().mockResolvedValue(undefined)
    const post = withConflictRetry(createTrade, onIndexing, wait, [10, 20, 30])
    const signed = { signature: '0x1' } as never
    await expect(post(signed)).resolves.toBe('trade-2')
    expect(createTrade).toHaveBeenCalledTimes(3)
    expect(createTrade.mock.calls.every(call => call[0] === signed)).toBe(true)
    expect(wait.mock.calls.map(c => c[0])).toEqual([10, 20])
    expect(onIndexing.mock.calls).toEqual([
      [1, 3],
      [2, 3]
    ])
  })

  it('gives up after the last delay and never retries other failures', async () => {
    const wait = vi.fn().mockResolvedValue(undefined)
    const stuck = withConflictRetry(vi.fn().mockRejectedValue(conflict), undefined, wait, [1, 1])
    await expect(stuck({} as never)).rejects.toBe(conflict)
    expect(wait).toHaveBeenCalledTimes(2)
    const other = vi.fn().mockRejectedValue(new Error('Invalid signature'))
    await expect(withConflictRetry(other, undefined, wait, [1])({} as never)).rejects.toThrow('Invalid signature')
    expect(other).toHaveBeenCalledTimes(1)
  })
})
