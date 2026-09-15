import { describe, expect, it, vi } from 'vitest'
import { ethers } from 'ethers'
import { ContractName, getContract } from 'decentraland-transactions'
import { encodeContractCall } from './auth/transactions'
import { BuilderServerError } from './builder'
import { type Collection } from './collections'
import { CreditsServerError } from './credits'
import { ItemType, type Item, BODY_SHAPE_FEMALE } from './items'
import { getPublicationFee } from './publishFee'
import {
  MAX_PUBLISH_ITEMS,
  PublishCollectionError,
  buildCollectionManagerExternalCall,
  buildCreateCollectionArgs,
  buildUseCreditsCall,
  canPayWith,
  consolidatePublishedCollection,
  getAvailablePaymentMethods,
  syncPublishedItems,
  getPublishBlocker,
  publishCollection,
  toPublishError,
  type PublishDeps
} from './publishCollection'

const CHAIN_ID = 80002
const ADDRESS = '0x00000000000000000000000000000000000000aa'
const SALT = '0x' + '11'.repeat(32)
const ETHER = 10n ** 18n

const collection: Collection = {
  id: 'col-1',
  name: 'Halloween',
  owner: ADDRESS,
  urn: 'urn:decentraland:amoy:collections-v2:0x0000000000000000000000000000000000000000',
  salt: SALT,
  isPublished: false,
  isApproved: false,
  itemCount: 2,
  minters: [],
  managers: [],
  createdAt: 1,
  updatedAt: 1
}

function makeItem(id: string, createdAt: number): Item {
  return {
    id,
    name: `Item ${id}`,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: ADDRESS,
    collectionId: collection.id,
    rarity: 'legendary',
    price: ethers.constants.MaxUint256.toString(),
    beneficiary: ADDRESS,
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: {
      category: 'hat',
      representations: [{ bodyShapes: [BODY_SHAPE_FEMALE], mainFile: 'm.glb', contents: ['m.glb'] }]
    },
    contents: { 'm.glb': 'hash', 'thumbnail.png': 'thumb' },
    createdAt,
    updatedAt: createdAt
  }
}

const items = [makeItem('b', 2), makeItem('a', 1)]

const fee = getPublicationFee(
  [
    {
      id: 'epic',
      name: 'epic',
      price: '1',
      maxSupply: '1000',
      prices: { USD: (5n * ETHER).toString(), MANA: (500n * ETHER).toString() }
    }
  ],
  items.length
)!

const authorization = {
  credit: {
    id: '0x01',
    amount: (1000n * ETHER).toString(),
    expiresAt: '1700000000',
    signature: '0x' + 'ab'.repeat(65)
  },
  externalCallSignature: '0x' + 'cd'.repeat(65)
}

function makeDeps(overrides: Partial<PublishDeps> = {}): PublishDeps & { calls: string[] } {
  const calls: string[] = []
  const track =
    <T extends unknown[], R>(name: string, impl: (...args: T) => R) =>
    (...args: T) => {
      calls.push(name)
      return impl(...args)
    }
  return {
    calls,
    saveCollection: track('saveCollection', async (c: Collection) => ({
      ...c,
      salt: SALT,
      contractAddress: '0xc0ffee'
    })),
    fetchItems: track('fetchItems', async () => items),
    rehashItem: track('rehashItem', async (item: Item) => item),
    saveTOS: track('saveTOS', async () => undefined),
    authorizePublication: track('authorizePublication', async () => authorization),
    sendTransaction: track('sendTransaction', async () => '0xtx'),
    lockCollection: track('lockCollection', async () => 1234),
    ...overrides
  }
}

describe('getPublishBlocker', () => {
  it('only lets an unlocked draft with 1..50 items publish', () => {
    expect(getPublishBlocker(collection, 3, [])).toBeNull()
    expect(getPublishBlocker(collection, 0, [])).toBe('no_items')
    expect(getPublishBlocker(collection, MAX_PUBLISH_ITEMS + 1, [])).toBe('too_many_items')
    expect(getPublishBlocker({ ...collection, isPublished: true }, 3, [])).toBe('not_draft')
    expect(getPublishBlocker({ ...collection, lock: Date.now() }, 3, [])).toBe('not_draft')
  })

  it('blocks publishing while a smart wearable has no preview video', () => {
    const smart = makeItem('sw', 3)
    smart.contents = { ...smart.contents, 'male/bin/game.js': 'js' }
    expect(getPublishBlocker(collection, 1, [smart])).toBe('missing_smart_wearable_video')
    smart.contents['video.mp4'] = 'video'
    expect(getPublishBlocker(collection, 1, [smart])).toBeNull()
  })
})

describe('payment methods', () => {
  it('offers credits always and MANA only with a positive balance', () => {
    expect(getAvailablePaymentMethods(undefined)).toEqual(['credits'])
    expect(getAvailablePaymentMethods(0n)).toEqual(['credits'])
    expect(getAvailablePaymentMethods(1n)).toEqual(['credits', 'mana'])
  })

  it('checks each method against its own balance', () => {
    expect(canPayWith('credits', fee, { credits: 100, manaWei: 0n })).toBe(true)
    expect(canPayWith('credits', fee, { credits: 99, manaWei: 0n })).toBe(false)
    expect(canPayWith('mana', fee, { credits: 0, manaWei: 1000n * ETHER })).toBe(true)
    expect(canPayWith('mana', fee, { credits: 0, manaWei: 999n * ETHER })).toBe(false)
  })
})

describe('createCollection encoding', () => {
  it('builds the CollectionManager arguments from the collection and its items sorted by creation', () => {
    const args = buildCreateCollectionArgs(collection, items, ADDRESS, CHAIN_ID)
    expect(args[0]).toBe(getContract(ContractName.Forwarder, CHAIN_ID).address)
    expect(args[1]).toBe(getContract(ContractName.CollectionFactoryV3, CHAIN_ID).address)
    expect(args[2]).toBe(SALT)
    expect(args[3]).toBe('Halloween')
    expect(args[4]).toBe('DCL-HLLWN')
    expect(args[6]).toBe(ADDRESS)
    expect(args[7].map(item => item[3])).toEqual(['1:w:Item a::hat:BaseFemale', '1:w:Item b::hat:BaseFemale'])
    expect(args[7][0][0]).toBe('legendary')
  })

  it('refuses a collection the server has not given a salt to', () => {
    expect(() => buildCreateCollectionArgs({ ...collection, salt: undefined }, items, ADDRESS, CHAIN_ID)).toThrow(
      PublishCollectionError
    )
  })

  it('encodes the external call the credits server co-signs', () => {
    const args = buildCreateCollectionArgs(collection, items, ADDRESS, CHAIN_ID)
    const now = 1_700_000_000_000
    const call = buildCollectionManagerExternalCall(CHAIN_ID, args, now, '0x' + '22'.repeat(32))
    const manager = getContract(ContractName.CollectionManager, CHAIN_ID)
    expect(call.target).toBe(manager.address)
    expect(call.selector).toBe(
      ethers.utils
        .id('createCollection(address,address,bytes32,string,string,string,address,(string,uint256,address,string)[])')
        .slice(0, 10)
    )
    expect(call.expiresAt).toBe(now / 1000 + 24 * 60 * 60)
    const decoded = ethers.utils.defaultAbiCoder.decode(
      [
        'address',
        'address',
        'bytes32',
        'string',
        'string',
        'string',
        'address',
        'tuple(string,uint256,address,string)[]'
      ],
      call.data
    )
    expect(decoded[3]).toBe('Halloween')
    expect(decoded[7]).toHaveLength(2)
  })

  it('produces a useCredits call the CreditsManager ABI accepts, with no MANA from the wallet', () => {
    const args = buildCreateCollectionArgs(collection, items, ADDRESS, CHAIN_ID)
    const externalCall = buildCollectionManagerExternalCall(CHAIN_ID, args)
    const call = buildUseCreditsCall(CHAIN_ID, authorization, externalCall)
    expect(call.contract.address).toBe(getContract(ContractName.CreditsManager, CHAIN_ID).address)
    const data = encodeContractCall(call)
    const decoded = new ethers.utils.Interface(call.contract.abi).decodeFunctionData('useCredits', data)
    expect(decoded._args.maxUncreditedValue.toString()).toBe('0')
    expect(decoded._args.maxCreditedValue.toString()).toBe(authorization.credit.amount)
    expect(decoded._args.customExternalCallSignature).toBe(authorization.externalCallSignature)
  })
})

describe('toPublishError', () => {
  it('maps known failures to their reasons and everything else to generic', () => {
    expect(toPublishError(new CreditsServerError('Insufficient credits', 402)).reason).toBe('insufficient_credits')
    expect(toPublishError(new BuilderServerError('locked', 423)).reason).toBe('locked')
    expect(toPublishError(Object.assign(new Error('denied'), { code: 4001 })).reason).toBe('rejected')
    expect(toPublishError(Object.assign(new Error('x'), { code: 'ACTION_REJECTED' })).reason).toBe('rejected')
    expect(toPublishError(new Error('MetaMask Tx Signature: User denied transaction signature.')).reason).toBe(
      'rejected'
    )
    expect(toPublishError(new Error('boom')).reason).toBe('generic')
    expect(toPublishError(new PublishCollectionError('unsynced')).reason).toBe('unsynced')
  })
})

describe('publishCollection', () => {
  const params = {
    address: ADDRESS,
    collection,
    items,
    paymentMethod: 'credits' as const,
    fee,
    email: 'jane.doe@example.com',
    chainId: CHAIN_ID
  }

  it('re-saves, verifies, records the ToS, pays with credits and locks — in that order', async () => {
    const deps = makeDeps()
    const result = await publishCollection(params, deps)
    expect(deps.calls).toEqual([
      'saveCollection',
      'fetchItems',
      'saveTOS',
      'authorizePublication',
      'sendTransaction',
      'lockCollection'
    ])
    expect(result.txHash).toBe('0xtx')
    expect(result.collection.lock).toBe(1234)
    expect(result.collection.contractAddress).toBe('0xc0ffee')
  })

  it('charges the fee in cents and sends the useCredits transaction to the CreditsManager', async () => {
    const authorize = vi.fn().mockResolvedValue(authorization)
    const send = vi.fn().mockResolvedValue('0xtx')
    await publishCollection(params, makeDeps({ authorizePublication: authorize, sendTransaction: send }))
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        usdPriceCents: 1000,
        chainId: CHAIN_ID,
        creditsManagerAddress: getContract(ContractName.CreditsManager, CHAIN_ID).address
      })
    )
    expect(send.mock.calls[0][0].method).toBe('useCredits')
  })

  it('pays with MANA by calling createCollection directly', async () => {
    const send = vi.fn().mockResolvedValue('0xtx')
    const deps = makeDeps({ sendTransaction: send })
    await publishCollection({ ...params, paymentMethod: 'mana' }, deps)
    expect(deps.calls).not.toContain('authorizePublication')
    expect(send.mock.calls[0][0].method).toBe('createCollection')
    expect(send.mock.calls[0][0].contract.address).toBe(getContract(ContractName.CollectionManager, CHAIN_ID).address)
  })

  it('skips the re-save while the collection is locked and the ToS without an email', async () => {
    const deps = makeDeps()
    await publishCollection({ ...params, collection: { ...collection, lock: Date.now() }, email: null }, deps)
    expect(deps.calls).not.toContain('saveCollection')
    expect(deps.calls).not.toContain('saveTOS')
  })

  it('re-saves items still carrying legacy hashes before the ToS and the payment', async () => {
    const legacy = { ...items[0], contents: { 'm.glb': 'QmOld', 'thumbnail.png': 'thumb' } }
    const rehashed = { ...legacy, contents: { 'm.glb': 'bafnew', 'thumbnail.png': 'thumb' } }
    const rehash = vi.fn().mockResolvedValue(rehashed)
    const deps = makeDeps({ fetchItems: async () => [legacy, items[1]], rehashItem: rehash })
    await publishCollection({ ...params, items: [legacy, items[1]] }, deps)
    expect(rehash).toHaveBeenCalledTimes(1)
    expect(rehash).toHaveBeenCalledWith(legacy)
    expect(deps.calls.indexOf('rehashItem')).toBeLessThan(deps.calls.indexOf('saveTOS'))
  })

  it('leaves items with current hashes alone', async () => {
    const deps = makeDeps()
    await publishCollection(params, deps)
    expect(deps.calls).not.toContain('rehashItem')
  })

  it('aborts before paying when the server items differ from the reviewed ones', async () => {
    const deps = makeDeps({ fetchItems: async () => [items[0]] })
    await expect(publishCollection(params, deps)).rejects.toMatchObject({ reason: 'unsynced' })
    expect(deps.calls).not.toContain('sendTransaction')
  })

  it('still succeeds when the lock fails after the transaction was sent, so it is never paid twice', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const deps = makeDeps({ lockCollection: async () => Promise.reject(new Error('boom')) })
    const result = await publishCollection(params, deps)
    expect(result.txHash).toBe('0xtx')
    expect(result.collection.lock).toBe(collection.lock)
  })

  it('fails when the server never produced a salt', async () => {
    const deps = makeDeps({ saveCollection: async c => ({ ...c, salt: undefined }) })
    await expect(publishCollection(params, deps)).rejects.toMatchObject({ reason: 'missing_salt' })
  })

  it('normalizes payment failures', async () => {
    const deps = makeDeps({ authorizePublication: async () => Promise.reject(new CreditsServerError('no', 402)) })
    await expect(publishCollection(params, deps)).rejects.toMatchObject({ reason: 'insufficient_credits' })
  })
})

describe('syncPublishedItems', () => {
  it('polls for an hour at most while the graph lags, by default', async () => {
    vi.useFakeTimers()
    const publish = vi.fn().mockRejectedValue(new BuilderServerError('not yet', 401))
    const run = syncPublishedItems('col-1', { publishCollectionItems: publish })
    const failure = expect(run).rejects.toThrow('not yet')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    await failure
    expect(publish).toHaveBeenCalledTimes(721)
    vi.useRealTimers()
  })
})

describe('consolidatePublishedCollection', () => {
  it('waits for the transaction, then retries the server sync while the graph lags', async () => {
    const publish = vi.fn().mockRejectedValueOnce(new BuilderServerError('not yet', 401)).mockResolvedValueOnce({})
    await consolidatePublishedCollection(
      'col-1',
      '0xtx',
      { waitForTransaction: async () => true, publishCollectionItems: publish },
      3,
      0
    )
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('gives up on a reverted transaction or a non-401 failure', async () => {
    await expect(
      consolidatePublishedCollection(
        'col-1',
        '0xtx',
        { waitForTransaction: async () => false, publishCollectionItems: vi.fn() },
        3,
        0
      )
    ).rejects.toThrow(/reverted/)
    await expect(
      consolidatePublishedCollection(
        'col-1',
        '0xtx',
        {
          waitForTransaction: async () => true,
          publishCollectionItems: async () => Promise.reject(new BuilderServerError('x', 500))
        },
        3,
        0
      )
    ).rejects.toThrow('x')
  })
})
