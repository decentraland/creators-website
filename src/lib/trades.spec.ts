import { afterEach, describe, expect, it, vi } from 'vitest'
import { ethers } from 'ethers'
import { Network, TradeAssetType, TradeType, type TradeCreation } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'

vi.mock('~/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('~/lib/auth')>('~/lib/auth')
  return { ...actual, readContract: vi.fn(), signedFetch: vi.fn() }
})

import { readContract, signedFetch } from '~/lib/auth'
import {
  OFFCHAIN_MARKETPLACE_TYPES,
  createTrade,
  fetchSignatureIndexes,
  getTradeDomain,
  toTradeTypedValues,
  type UnsignedTrade
} from './trades'

const CHAIN_ID = 80002
const SIGNER = '0x00000000000000000000000000000000000000aa'
const COLLECTION = '0x00000000000000000000000000000000000000cc'
const MANA = getContract(ContractName.MANAToken, CHAIN_ID).address

const trade: UnsignedTrade = {
  signer: SIGNER,
  network: Network.MATIC,
  chainId: CHAIN_ID,
  type: TradeType.PUBLIC_ITEM_ORDER,
  checks: {
    uses: 90,
    expiration: 4102444800000,
    effective: 1757500000123,
    salt: '0x01',
    contractSignatureIndex: 2,
    signerSignatureIndex: 3,
    allowedRoot: '0x',
    externalChecks: []
  },
  sent: [{ assetType: TradeAssetType.COLLECTION_ITEM, contractAddress: COLLECTION, itemId: '7', extra: '' }],
  received: [
    {
      assetType: TradeAssetType.USD_PEGGED_MANA,
      contractAddress: MANA,
      amount: '500000000000000000',
      extra: '',
      beneficiary: SIGNER
    }
  ]
}

afterEach(() => vi.mocked(signedFetch).mockReset())

describe('getTradeDomain', () => {
  it('names the marketplace contract and carries the chain id in the salt', () => {
    const contract = getContract(ContractName.OffChainMarketplaceV2, CHAIN_ID)
    expect(getTradeDomain(CHAIN_ID)).toEqual({
      name: contract.name,
      version: contract.version,
      salt: ethers.utils.hexZeroPad(ethers.utils.hexlify(CHAIN_ID), 32),
      verifyingContract: contract.address
    })
  })
})

describe('toTradeTypedValues', () => {
  it('produces a struct the marketplace types can hash: seconds, padded bytes32, flattened assets', () => {
    const values = toTradeTypedValues(trade)
    expect(values).toEqual({
      checks: {
        uses: 90,
        expiration: 4102444800,
        effective: 1757500000,
        salt: '0x' + '00'.repeat(31) + '01',
        contractSignatureIndex: 2,
        signerSignatureIndex: 3,
        allowedRoot: '0x' + '00'.repeat(32),
        externalChecks: []
      },
      sent: [{ assetType: 4, contractAddress: COLLECTION, value: '7', extra: '0x' }],
      received: [{ assetType: 2, contractAddress: MANA, value: '500000000000000000', extra: '0x', beneficiary: SIGNER }]
    })
    // The struct must encode under the EIP-712 types, otherwise the wallet refuses to sign it.
    const types = { ...OFFCHAIN_MARKETPLACE_TYPES }
    expect(() => ethers.utils._TypedDataEncoder.hash(getTradeDomain(CHAIN_ID), types, values)).not.toThrow()
  })
})

describe('fetchSignatureIndexes', () => {
  it('reads both indexes from the marketplace contract', async () => {
    vi.mocked(readContract).mockImplementation(async (_contract, method) =>
      ethers.BigNumber.from(method === 'contractSignatureIndex' ? 1 : 4)
    )
    await expect(fetchSignatureIndexes(SIGNER, CHAIN_ID)).resolves.toEqual({
      contractSignatureIndex: 1,
      signerSignatureIndex: 4
    })
    const contract = getContract(ContractName.OffChainMarketplaceV2, CHAIN_ID)
    expect(readContract).toHaveBeenCalledWith(contract, 'contractSignatureIndex')
    expect(readContract).toHaveBeenCalledWith(contract, 'signerSignatureIndex', [SIGNER])
  })
})

describe('createTrade', () => {
  const signed: TradeCreation = { ...trade, signature: '0xsig' }

  it('posts the signed order to marketplace-server as the builder and answers the trade id', async () => {
    vi.mocked(signedFetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { id: 'trade-1' } }), { status: 201 })
    )
    await expect(createTrade(SIGNER, signed)).resolves.toBe('trade-1')
    expect(signedFetch).toHaveBeenCalledWith(
      SIGNER,
      'https://marketplace-api.decentraland.zone',
      '/v1/trades',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(signed) }),
      { signer: 'dcl:builder', intent: 'dcl:create-trade' }
    )
  })

  it('surfaces the server message when the order is rejected', async () => {
    vi.mocked(signedFetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, message: 'Invalid signature' }), { status: 400 })
    )
    await expect(createTrade(SIGNER, signed)).rejects.toThrow('Invalid signature')
  })
})
