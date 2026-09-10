// Read-only client for the Catalyst content server: the deployed entity of a published item is the
// version the world and the marketplace show, which the builder copy is compared against.
import { type Entity } from '@dcl/schemas'
import { config } from '~/config'

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
