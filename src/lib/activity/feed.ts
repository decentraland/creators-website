import { type ActivityEvent, type ActivityEventInput } from './types'

/**
 * The page to show: server rows, plus the transactions this tab sent that the server hasn't listed yet
 * (its copy is the truth as soon as it has one). Newest first.
 */
export function mergeActivity(local: ActivityEvent[], server: ActivityEvent[]): ActivityEvent[] {
  const known = new Set(server.map(event => event.txHash.toLowerCase()))
  const unlisted = local.filter(event => !known.has(event.txHash.toLowerCase()))
  return [...unlisted, ...server].sort((a, b) => b.timestamp - a.timestamp)
}

export function hasPendingActivity(events: ActivityEvent[]): boolean {
  return events.some(event => event.status === 'pending')
}

export type ActivityDescription = {
  /** i18n key under `activity_page.event`. */
  key: string
  values: Record<string, string | number>
}

/** Which sentence the row shows and what fills its blanks. */
export function describeActivity(event: ActivityEventInput): ActivityDescription {
  const values: Record<string, string | number> = {
    collection: event.collectionName ?? '',
    item: event.itemName ?? '',
    count: event.count ?? 0
  }
  switch (event.type) {
    case 'set_roles':
      return { key: `set_roles_${event.kind ?? 'collaborators'}`, values }
    case 'send_items':
      return { key: event.itemName && event.count === 1 ? 'send_item' : 'send_items', values }
    default:
      return { key: event.type, values }
  }
}

const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  80002: 'https://amoy.polygonscan.com'
}

/** The block explorer page of a transaction; undefined for a chain without a known explorer. */
export function getTransactionUrl(chainId: number, txHash: string): string | undefined {
  const explorer = EXPLORERS[chainId]
  return explorer ? `${explorer}/tx/${txHash}` : undefined
}
