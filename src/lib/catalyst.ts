// Read-only client for the Catalyst content server: the deployed entity of a published item is the
// version the world and the marketplace show, which the builder copy is compared against.
import { type BodyShape, type Entity, type WearableCategory } from '@dcl/schemas'
import { config } from '~/config'
import { getBaseWearableName, type BaseWearable } from './avatar'

const contentUrl = () => `${config.get('PEER_URL')}/content`

/** The active entities deployed under the given pointers (item URNs). Pointers with no entity are simply absent. */
export async function fetchEntitiesByPointers(pointers: string[]): Promise<Entity[]> {
  if (pointers.length === 0) return []
  const response = await fetch(`${contentUrl()}/entities/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pointers })
  })
  if (!response.ok) throw new Error(`catalyst request failed: entities/active (${response.status})`)
  return (await response.json()) as Entity[]
}

/** One deployed file by hash. */
export async function fetchCatalystContent(hash: string): Promise<Blob> {
  const response = await fetch(`${contentUrl()}/contents/${hash}`)
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`catalyst request failed: contents/${hash} (${response.status})`)
  }
  return response.blob()
}

const BASE_AVATARS_COLLECTION = 'urn:decentraland:off-chain:base-avatars'

type CatalystWearable = {
  id: string
  data: {
    category: WearableCategory
    hides?: string[]
    replaces?: string[]
    representations: Array<{ bodyShapes: BodyShape[] }>
  }
}

/**
 * The base-avatars catalog the preview mannequin is dressed from (legacy handleFetchBaseWearables):
 * wearables that hide or replace anything are dropped, they would fight with the item being edited.
 */
export async function fetchBaseWearables(): Promise<BaseWearable[]> {
  const response = await fetch(
    `${config.get('PEER_URL')}/lambdas/collections/wearables?collectionId=${BASE_AVATARS_COLLECTION}`
  )
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`catalyst request failed: base wearables (${response.status})`)
  }
  const { wearables } = (await response.json()) as { wearables: CatalystWearable[] }
  return wearables
    .filter(wearable => !wearable.data.hides?.length && !wearable.data.replaces?.length)
    .map(wearable => ({
      urn: wearable.id,
      category: wearable.data.category,
      bodyShapes: Array.from(
        new Set(wearable.data.representations.flatMap(representation => representation.bodyShapes))
      ),
      name: getBaseWearableName(wearable.id)
    }))
}
