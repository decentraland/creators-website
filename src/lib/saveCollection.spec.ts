import { describe, it, expect } from 'vitest'
import { ethers } from 'ethers'
import { config } from '~/config'
import { ItemType, type Item } from './items'
import {
  buildCollectionInitializeData,
  buildDefaultCatalystCollectionURN,
  buildNewCollection,
  getCollectionSymbol,
  toInitializeItems
} from './saveCollection'

// Lowercase like every address that leaves lib/auth (mixed case would fail ethers' checksum).
const OWNER = '0xabc0000000000000000000000000000000000001'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    name: 'Pirate Hat',
    description: 'Yarr',
    thumbnail: 'thumbnail.png',
    owner: OWNER,
    rarity: 'Legendary',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: {
      category: 'hat',
      representations: [
        { bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'], mainFile: 'hat.glb', contents: [] }
      ]
    },
    contents: {},
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

describe('getCollectionSymbol', () => {
  it('strips lowercase vowels and whitespace, uppercases, and prefixes DCL-', () => {
    // Exact legacy behavior: only lowercase vowels are stripped.
    expect(getCollectionSymbol('Pirate Hats')).toBe('DCL-PRTHTS')
    expect(getCollectionSymbol('Halloween')).toBe('DCL-HLLWN')
    expect(getCollectionSymbol('AEIOU aeiou')).toBe('DCL-AEIOU')
  })
})

describe('buildDefaultCatalystCollectionURN', () => {
  it('uses the env URN protocol and the zero address', () => {
    expect(buildDefaultCatalystCollectionURN()).toBe(
      `urn:decentraland:${config.get('MATIC_URN_PROTOCOL')}:collections-v2:0x0000000000000000000000000000000000000000`
    )
  })
})

describe('buildNewCollection', () => {
  it('creates an unpublished draft owned by the given address', () => {
    const collection = buildNewCollection('Pirate Hats', OWNER)
    expect(collection).toMatchObject({
      name: 'Pirate Hats',
      owner: OWNER,
      isPublished: false,
      isApproved: false,
      itemCount: 0,
      minters: [],
      managers: []
    })
    expect(collection.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(collection.urn).toBe(buildDefaultCatalystCollectionURN())
    expect(collection.createdAt).toBe(collection.updatedAt)
  })

  it('gives every collection its own id', () => {
    expect(buildNewCollection('A', OWNER).id).not.toBe(buildNewCollection('A', OWNER).id)
  })
})

describe('toInitializeItems', () => {
  it('encodes items sorted by creation date with legacy defaults', () => {
    const items = [
      makeItem({ id: 'newer', createdAt: 2000, price: '5', beneficiary: '0x0000000000000000000000000000000000000002' }),
      makeItem({ id: 'older', createdAt: 1000 })
    ]
    expect(toInitializeItems(items)).toEqual([
      ['legendary', '0', ethers.constants.AddressZero, '1:w:Pirate Hat:Yarr:hat:BaseMale'],
      ['legendary', '5', '0x0000000000000000000000000000000000000002', '1:w:Pirate Hat:Yarr:hat:BaseMale']
    ])
  })
})

describe('buildCollectionInitializeData', () => {
  it('encodes calldata that decodes back to the initialize arguments', () => {
    const collection = buildNewCollection('Pirate Hats', OWNER)
    const data = buildCollectionInitializeData(collection, [makeItem()], OWNER)

    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['string', 'string', 'string', 'address', 'bool', 'bool', 'address', 'tuple(string,uint256,address,string)[]'],
      ethers.utils.hexDataSlice(data, 4)
    )
    expect(decoded[0]).toBe('Pirate Hats')
    expect(decoded[1]).toBe('DCL-PRTHTS')
    expect(decoded[2]).toBe(config.get('ERC721_COLLECTION_BASE_URI'))
    expect(decoded[3].toLowerCase()).toBe(OWNER.toLowerCase())
    expect(decoded[4]).toBe(true) // should complete
    expect(decoded[5]).toBe(false) // is approved
    expect(decoded[6].toLowerCase()).toBe(config.get('RARITIES_WITH_ORACLE_ADDRESS').toLowerCase())
    expect(decoded[7]).toHaveLength(1)
    expect(decoded[7][0][0]).toBe('legendary')
    expect(decoded[7][0][3]).toBe('1:w:Pirate Hat:Yarr:hat:BaseMale')
  })

  it('starts with the initialize selector', () => {
    const collection = buildNewCollection('X', OWNER)
    const data = buildCollectionInitializeData(collection, [], OWNER)
    const selector = ethers.utils
      .id('initialize(string,string,string,address,bool,bool,address,(string,uint256,address,string)[])')
      .slice(0, 10)
    expect(data.startsWith(selector)).toBe(true)
  })
})
