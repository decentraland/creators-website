import { describe, expect, it } from 'vitest'
import { ContractName, getContract } from 'decentraland-transactions'
import { encodeContractCall } from './auth/transactions'
import { type Collection } from './collections'
import { ItemType, type Item } from './items'
import {
  MAX_ITEMS_PER_SEND,
  buildIssueTokensCall,
  canContinue,
  canSendCollectionItems,
  copiesPerItem,
  copiesPerRecipient,
  flattenTransfers,
  getStock,
  isSendableItem,
  maxAmount,
  totalCopies,
  type Transfer
} from './mint'

const OWNER = '0x00000000000000000000000000000000000000aa'
const MINTER = '0x00000000000000000000000000000000000000bb'
const MANAGER = '0x00000000000000000000000000000000000000cc'
const CONTRACT = '0x00000000000000000000000000000000000000dd'
const CHAIN_ID = 80002

const collection: Collection = {
  id: 'c1',
  name: 'Hats',
  owner: OWNER,
  urn: `urn:decentraland:amoy:collections-v2:${CONTRACT}`,
  contractAddress: CONTRACT,
  isPublished: true,
  isApproved: true,
  itemCount: 2,
  minters: [MINTER.toUpperCase()],
  managers: [MANAGER],
  createdAt: 1,
  updatedAt: 1
}

function makeItem(id: string, tokenId: string, totalSupply: number, rarity = 'legendary'): Item {
  return {
    id,
    name: id,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: OWNER,
    collectionId: 'c1',
    rarity,
    totalSupply,
    tokenId,
    isPublished: true,
    isApproved: true,
    inCatalyst: true,
    type: ItemType.WEARABLE,
    data: { category: 'hat', representations: [] },
    contents: {},
    createdAt: 1,
    updatedAt: 1
  }
}

// Legendary: 100 copies. hat has 93 left, cap 2.
const hat = makeItem('hat', '1', 7)
const cap = makeItem('cap', '2', 98)

describe('canSendCollectionItems', () => {
  it('lets the owner and minters of an approved collection send, but not collaborators or strangers', () => {
    expect(canSendCollectionItems(collection, OWNER)).toBe(true)
    expect(canSendCollectionItems(collection, MINTER)).toBe(true)
    expect(canSendCollectionItems(collection, MANAGER)).toBe(false)
    expect(canSendCollectionItems(collection, undefined)).toBe(false)
    expect(canSendCollectionItems({ ...collection, isApproved: false, reviewedAt: 1, createdAt: 1 }, OWNER)).toBe(false)
  })
})

describe('isSendableItem / getStock', () => {
  it('needs a published, approved item with a token id and a rarity; sold out still counts as sendable', () => {
    expect(isSendableItem(hat)).toBe(true)
    expect(isSendableItem(makeItem('x', '9', 100))).toBe(true)
    expect(isSendableItem({ ...hat, tokenId: undefined })).toBe(false)
    expect(isSendableItem({ ...hat, isApproved: false })).toBe(false)
    expect(isSendableItem({ ...hat, rarity: undefined })).toBe(false)
    expect(getStock(hat)).toEqual({ available: 93, total: 100 })
    expect(getStock(makeItem('x', '9', 120))).toEqual({ available: 0, total: 100 })
  })
})

describe('allocation math', () => {
  const transfers: Transfer[] = [
    { recipients: ['0xa', '0xb'], amounts: { hat: 3, cap: 1 } },
    { recipients: ['0xc'], amounts: { hat: 2 } }
  ]

  it('counts copies as recipients × amounts across transfers', () => {
    expect(totalCopies(transfers)).toBe(2 * 4 + 2)
    expect(copiesPerItem(transfers)).toEqual({ hat: 8, cap: 2 })
  })

  it('merges what every wallet receives across transfers, skipping empty ones', () => {
    const repeated: Transfer[] = [
      ...transfers,
      { recipients: ['0xa'], amounts: { cap: 2 } },
      { recipients: ['0xd'], amounts: {} }
    ]
    expect(copiesPerRecipient(repeated)).toEqual([
      { address: '0xa', amounts: { hat: 3, cap: 3 } },
      { address: '0xb', amounts: { hat: 3, cap: 1 } },
      { address: '0xc', amounts: { hat: 2 } }
    ])
  })

  it('caps an amount by the stock left after the other transfers, per recipient', () => {
    // cap: 2 left, 2 recipients in the first transfer → 1 each; nothing left for the second transfer.
    expect(maxAmount(cap, transfers, 0)).toBe(1)
    expect(maxAmount(cap, transfers, 1)).toBe(0)
    // hat: 93 - 2 (other transfer) = 91 for the first transfer's 2 recipients → 45 each.
    expect(maxAmount(hat, transfers, 0)).toBe(45)
    // A transfer without recipients yet is sized as if it had one.
    expect(maxAmount(hat, [{ recipients: [], amounts: {} }], 0)).toBe(93)
  })

  it('continues only with something to send and at most the per-transaction limit', () => {
    expect(canContinue([{ recipients: ['0xa'], amounts: {} }])).toBe(false)
    expect(canContinue([{ recipients: [], amounts: { hat: 5 } }])).toBe(false)
    expect(canContinue(transfers)).toBe(true)
    expect(canContinue([{ recipients: ['0xa'], amounts: { hat: MAX_ITEMS_PER_SEND } }])).toBe(true)
    expect(canContinue([{ recipients: ['0xa'], amounts: { hat: MAX_ITEMS_PER_SEND + 1 } }])).toBe(false)
  })
})

describe('flattenTransfers / buildIssueTokensCall', () => {
  it('repeats each recipient once per copy, in parallel with the item token ids, skipping incomplete transfers', () => {
    const transfers: Transfer[] = [
      { recipients: ['0xa', '0xb'], amounts: { hat: 2, cap: 1 } },
      { recipients: [], amounts: { hat: 5 } },
      { recipients: ['0xc'], amounts: { hat: 0 } }
    ]
    expect(flattenTransfers(transfers, [hat, cap])).toEqual({
      beneficiaries: ['0xa', '0xa', '0xa', '0xb', '0xb', '0xb'],
      tokenIds: ['1', '1', '2', '1', '1', '2']
    })
  })

  it('encodes issueTokens on the collection contract and refuses a collection without one', () => {
    const call = buildIssueTokensCall(collection, ['0x00000000000000000000000000000000000000ee'], ['1'], CHAIN_ID)
    expect(call.contract.address).toBe(CONTRACT)
    expect(call.contract.abi).toBe(getContract(ContractName.ERC721CollectionV2, CHAIN_ID).abi)
    expect(encodeContractCall(call).startsWith('0x')).toBe(true)
    expect(() => buildIssueTokensCall({ ...collection, contractAddress: undefined }, [], [], CHAIN_ID)).toThrow(
      /no contract/
    )
  })
})
