// The retrieval seam: pages and hooks talk to an ActivitySource and never to a server directly, so the
// log can move from builder-server's client-reported table to an indexer-backed feed by adding a source
// here and flipping ACTIVITY_SOURCE in the env config.
import { config } from '~/config'
import { type PaginatedResource } from '~/lib/collections'
import { builderServerActivitySource } from './builderServer'
import { type ActivityEvent, type UnsavedActivityEvent } from './types'

export type ActivityPage = PaginatedResource<ActivityEvent>

export type ActivitySource = {
  /** The wallet's transactions, newest first. */
  list(address: string, params: { page: number; limit: number }): Promise<ActivityPage>
  /** Stores a transaction the wallet just sent and resolves with the stored copy. */
  record(address: string, event: UnsavedActivityEvent): Promise<ActivityEvent>
}

export const DEFAULT_ACTIVITY_SOURCE = 'builder-server'

const sources: Record<string, ActivitySource> = {
  [DEFAULT_ACTIVITY_SOURCE]: builderServerActivitySource
}

export function getActivitySource(
  name: string = config.get('ACTIVITY_SOURCE', DEFAULT_ACTIVITY_SOURCE)
): ActivitySource {
  return sources[name] ?? sources[DEFAULT_ACTIVITY_SOURCE]
}
