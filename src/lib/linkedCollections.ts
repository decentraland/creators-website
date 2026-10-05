// Linked collections are builder-server's third-party collections (linked wearables). This app only
// shows them; they are created and edited in the legacy builder.
import { MappingType, type ContractNetwork, type Mappings } from '@dcl/schemas'
import { config } from '~/config'
import { CurationStatus, isLinkedCollection, type Collection } from './collections'

/** The third party's id is its collection URN without the collection suffix. */
export function getThirdPartyId(collection: Pick<Collection, 'urn'>): string | undefined {
  if (!isLinkedCollection(collection)) return undefined
  const parts = collection.urn.split(':')
  return parts.length > 5 ? parts.slice(0, 5).join(':') : undefined
}

export type ThirdParty = { name: string; managers: string[] }

/**
 * Linked collections belong to a third party, not a wallet (builder-server leaves their owner empty):
 * its managers are who may see them, the same check builder-server makes.
 */
export function isThirdPartyManager(thirdParty: ThirdParty, address: string | undefined): boolean {
  if (!address) return false
  return thirdParty.managers.some(manager => manager.toLowerCase() === address.toLowerCase())
}

export function builderLinkedCollectionUrl(collectionId: string): string {
  return `${config.get('BUILDER_URL')}/thirdPartyCollections/${encodeURIComponent(collectionId)}`
}

export enum LinkedItemStatus {
  PUBLISHED = 'published',
  UNDER_REVIEW = 'under_review',
  REJECTED = 'rejected',
  NOT_PUBLISHED = 'not_published'
}

/** A linked item is curated on its own: its latest item curation is its status. */
export function getLinkedItemStatus(curationStatus: CurationStatus | undefined): LinkedItemStatus {
  switch (curationStatus) {
    case CurationStatus.APPROVED:
      return LinkedItemStatus.PUBLISHED
    case CurationStatus.PENDING:
      return LinkedItemStatus.UNDER_REVIEW
    case CurationStatus.REJECTED:
      return LinkedItemStatus.REJECTED
    default:
      return LinkedItemStatus.NOT_PUBLISHED
  }
}

/** The item's token mapping for the collection's linked contract, as the message that labels it. */
export function getMappingLabel(
  mappings: unknown,
  network: string | undefined,
  contractAddress: string | undefined
): { id: string; values?: Record<string, string | number> } {
  const key = (name: string) => `linked_collection.mapping.${name}`
  if (!mappings || typeof mappings !== 'object' || !network || !contractAddress) return { id: key('none') }
  const contracts = (mappings as Mappings)[network as ContractNetwork]
  const entries = contracts
    ? Object.entries(contracts).find(([address]) => address.toLowerCase() === contractAddress.toLowerCase())?.[1]
    : undefined
  if (!Array.isArray(entries) || entries.length === 0) return { id: key('none') }
  if (entries.length > 1) return { id: key('rules'), values: { count: entries.length } }
  const [mapping] = entries
  switch (mapping.type) {
    case MappingType.ANY:
      return { id: key('any') }
    case MappingType.SINGLE:
      return { id: key('single'), values: { id: mapping.id } }
    case MappingType.RANGE:
      return { id: key('range'), values: { from: mapping.from, to: mapping.to } }
    case MappingType.MULTIPLE:
      return { id: key('multiple'), values: { count: mapping.ids.length } }
    default:
      return { id: key('none') }
  }
}
