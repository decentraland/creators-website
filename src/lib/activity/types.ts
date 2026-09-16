export const ACTIVITY_EVENT_TYPES = [
  'approve_mana',
  'publish_collection',
  'enable_sales',
  'set_roles',
  'send_items',
  'remove_listing',
  'update_price'
] as const

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number]

export type ActivityStatus = 'pending' | 'confirmed' | 'reverted' | 'dropped'

export type ActivityRoleKind = 'senders' | 'collaborators'

/** What the row says about the transaction; every field is optional because not every event has a subject. */
export type ActivityDetails = {
  collectionId?: string
  collectionName?: string
  itemId?: string
  itemName?: string
  count?: number
  kind?: ActivityRoleKind
}

export type ActivityEventInput = ActivityDetails & { type: ActivityEventType }

export type ActivityEvent = ActivityEventInput & {
  id: string
  txHash: string
  chainId: number
  status: ActivityStatus
  timestamp: number
}

/** A transaction as the wallet just sent it, before any server has seen it. */
export type UnsavedActivityEvent = Omit<ActivityEvent, 'id' | 'status' | 'timestamp'>
