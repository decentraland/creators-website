// Turns reviewed drafts into an ordered upload plan and executes it against builder-server.
// Variants merge into their target (batch drafts client-side, existing items via representation
// append) so a base item is never uploaded after a variant that depends on it.
import { ALREADY_PUBLISHED_STATUS, BuilderServerError, COLLECTION_LOCKED_STATUS, saveItem } from './builder'
import { THUMBNAIL_PATH } from './itemFiles'
import { addRepresentationToItem, buildItem, type BuiltItem, type ItemDraftPayload } from './itemFactory'
import { type Item } from './items'

export type UploadDraft = ItemDraftPayload & {
  /** When set, this draft is a body-shape variant of another batch draft or an existing item. */
  variantTargetId?: string
}

/** One PUT+files request; carries every draft id it satisfies so failures map back to drafts. */
export type UploadOperation = {
  built: BuiltItem
  draftIds: string[]
  /** True when this operation updates an existing collection item instead of creating one. */
  isExistingItemUpdate: boolean
}

export type UploadFailureReason = 'locked' | 'published' | 'generic'

export type UploadResult = {
  savedDraftIds: string[]
  failedDraftIds: string[]
  failureReason: UploadFailureReason | null
}

/**
 * Builds the ordered operation list: base items first (batch variants merged into them), then
 * representation appends onto existing collection items.
 */
export async function planUpload(drafts: UploadDraft[], existingItems: Item[]): Promise<UploadOperation[]> {
  const operations: UploadOperation[] = []
  const builtByDraftId = new Map<string, UploadOperation>()

  for (const draft of drafts.filter(candidate => !candidate.variantTargetId)) {
    const operation: UploadOperation = {
      built: await buildItem(draft),
      draftIds: [draft.id],
      isExistingItemUpdate: false
    }
    operations.push(operation)
    builtByDraftId.set(draft.id, operation)
  }

  for (const draft of drafts.filter(candidate => !!candidate.variantTargetId)) {
    const targetOperation = builtByDraftId.get(draft.variantTargetId!)
    if (targetOperation) {
      // Variant of another draft in this batch: merge into that item before it uploads.
      targetOperation.built = await addRepresentationToItem(targetOperation.built, draft)
      targetOperation.draftIds.push(draft.id)
      continue
    }

    const existingItem = existingItems.find(item => item.id === draft.variantTargetId)
    if (!existingItem) {
      throw new Error(`Variant target "${draft.variantTargetId!}" is not in the batch or the collection`)
    }
    const built = await addRepresentationToItem({ item: existingItem }, draft)
    // Never replace an existing item's thumbnail when appending a representation.
    delete built.blobs[THUMBNAIL_PATH]
    operations.push({ built, draftIds: [draft.id], isExistingItemUpdate: true })
  }

  return operations
}

function toFailureReason(error: unknown): UploadFailureReason {
  if (error instanceof BuilderServerError) {
    if (error.status === COLLECTION_LOCKED_STATUS) return 'locked'
    if (error.status === ALREADY_PUBLISHED_STATUS) return 'published'
  }
  return 'generic'
}

/**
 * Uploads the operations sequentially. A locked/published collection aborts the rest (retrying
 * can never succeed); any other failure moves on to the next operation.
 */
export async function executeUpload(address: string, operations: UploadOperation[]): Promise<UploadResult> {
  const savedDraftIds: string[] = []
  const failedDraftIds: string[] = []
  let failureReason: UploadFailureReason | null = null

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    try {
      await saveItem(address, operation.built.item, operation.built.blobs)
      savedDraftIds.push(...operation.draftIds)
    } catch (error) {
      const reason = toFailureReason(error)
      failureReason = failureReason === null || reason !== 'generic' ? reason : failureReason
      failedDraftIds.push(...operation.draftIds)
      if (reason !== 'generic') {
        for (const remaining of operations.slice(i + 1)) {
          failedDraftIds.push(...remaining.draftIds)
        }
        break
      }
    }
  }

  return { savedDraftIds, failedDraftIds, failureReason }
}
