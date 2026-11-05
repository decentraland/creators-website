// Builder-server rows in the wire shape (snake_case, `{ ok, data }` unwrapped), as `lib/builder` reads them.
import { TEST_ADDRESS } from './helpers/session'

const NOW = '2026-11-01T12:00:00.000Z'
const MALE = 'urn:decentraland:off-chain:base-avatars:BaseMale'
const FEMALE = 'urn:decentraland:off-chain:base-avatars:BaseFemale'

export type RemoteCollectionRow = {
  id: string
  name: string
  eth_address: string
  salt: string | null
  contract_address: string | null
  urn: string
  is_published: boolean
  is_approved: boolean
  minters: string[]
  managers: string[]
  forum_link: string | null
  lock: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  item_count: string
  linked_contract_address: string | null
  linked_contract_network: string | null
  is_mapping_complete: boolean
  curation_status?: 'pending' | 'approved' | 'rejected' | null
  last_activity_at?: string
}

export type RemoteItemRow = {
  id: string
  name: string
  description: string
  thumbnail: string
  eth_address: string
  collection_id: string | null
  blockchain_item_id: string | null
  price: string | null
  beneficiary: string | null
  rarity: string | null
  total_supply: number
  is_published: boolean
  is_approved: boolean
  in_catalyst: boolean
  type: 'wearable' | 'emote'
  data: Record<string, unknown>
  metrics: Record<string, number>
  contents: Record<string, string>
  urn: string | null
  created_at: string
  updated_at: string
}

let sequence = 0
const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`

export function collection(overrides: Partial<RemoteCollectionRow> = {}): RemoteCollectionRow {
  const id = overrides.id ?? nextId()
  return {
    id,
    name: 'Neon Streetwear',
    eth_address: TEST_ADDRESS,
    salt: null,
    contract_address: null,
    urn: `urn:decentraland:amoy:collections-v2:${id}`,
    is_published: false,
    is_approved: false,
    minters: [],
    managers: [],
    forum_link: null,
    lock: null,
    reviewed_at: null,
    created_at: NOW,
    updated_at: NOW,
    item_count: '0',
    linked_contract_address: null,
    linked_contract_network: null,
    is_mapping_complete: false,
    curation_status: null,
    last_activity_at: NOW,
    ...overrides
  }
}

/** A collection on chain and approved: what the list shows as Published. */
export function publishedCollection(overrides: Partial<RemoteCollectionRow> = {}): RemoteCollectionRow {
  return collection({
    contract_address: '0x' + 'a1'.repeat(20),
    salt: '0x' + '00'.repeat(32),
    is_published: true,
    is_approved: true,
    reviewed_at: NOW,
    curation_status: 'approved',
    ...overrides
  })
}

export function wearable(overrides: Partial<RemoteItemRow> = {}): RemoteItemRow {
  return {
    id: nextId(),
    name: 'Red Bandana',
    description: '',
    thumbnail: 'thumbnail.png',
    eth_address: TEST_ADDRESS,
    collection_id: null,
    blockchain_item_id: null,
    price: null,
    beneficiary: null,
    rarity: null,
    total_supply: 0,
    is_published: false,
    is_approved: false,
    in_catalyst: false,
    type: 'wearable',
    data: {
      category: 'hat',
      hides: [],
      replaces: [],
      tags: [],
      requiredPermissions: [],
      representations: [
        {
          bodyShapes: [MALE],
          mainFile: 'male/hat.glb',
          contents: ['male/hat.glb'],
          overrideHides: [],
          overrideReplaces: []
        },
        {
          bodyShapes: [FEMALE],
          mainFile: 'female/hat.glb',
          contents: ['female/hat.glb'],
          overrideHides: [],
          overrideReplaces: []
        }
      ]
    },
    metrics: { triangles: 540, materials: 1, textures: 1, meshes: 1, bodies: 1, entities: 1 },
    contents: { 'male/hat.glb': 'bafyhat', 'female/hat.glb': 'bafyhat', 'thumbnail.png': 'bafythumbnail' },
    urn: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides
  }
}

export const RARITIES = [
  { id: 'common', name: 'common', price: '1000000000000000000', maxSupply: '100000' },
  { id: 'uncommon', name: 'uncommon', price: '1000000000000000000', maxSupply: '10000' },
  { id: 'rare', name: 'rare', price: '1000000000000000000', maxSupply: '5000' },
  { id: 'epic', name: 'epic', price: '1000000000000000000', maxSupply: '1000' },
  { id: 'legendary', name: 'legendary', price: '1000000000000000000', maxSupply: '100' },
  { id: 'exotic', name: 'exotic', price: '1000000000000000000', maxSupply: '50' },
  { id: 'mythic', name: 'mythic', price: '1000000000000000000', maxSupply: '10' },
  { id: 'unique', name: 'unique', price: '1000000000000000000', maxSupply: '1' }
]
