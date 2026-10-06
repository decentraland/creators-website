import { useEffect, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { createCollectionForumPost, createCurationForumReply } from '~/lib/builder'
import { canManageCollectionItems, toSafeLink, type Collection } from '~/lib/collections'
import { buildAssigneeReply, createCollectionForumPost as createTopic } from '~/lib/forumPost'
import { type Item } from '~/lib/items'
import { captureError } from '~/lib/monitoring'
import { profileQuery } from '~/hooks/useProfile'

export type ForumPostSource = 'publish' | 'recovery'

// Collections whose topic this tab is creating or already tried to recover, so it never posts twice.
const posting = new Set<string>()
const recovered = new Set<string>()

/** Opens the collection's forum topic once its publish is synced; failures are reported, never thrown. */
export async function postCollectionToForum(
  queryClient: QueryClient,
  address: string,
  collection: Collection,
  source: ForumPostSource
): Promise<void> {
  if (collection.forumLink || posting.has(collection.id)) return
  posting.add(collection.id)
  try {
    const forumLink = toSafeLink(
      await createTopic(collection.id, { createPost: id => createCollectionForumPost(address, id) })
    )
    track('Create forum post', { collectionId: collection.id, source })
    queryClient.setQueryData<Collection>(['collection', address, collection.id], current =>
      current && forumLink ? { ...current, forumLink } : current
    )
    void queryClient.invalidateQueries({ queryKey: ['collection', address, collection.id] })
  } catch (error) {
    track('Create forum post error', { collectionId: collection.id, source, error: errorCode(error) })
    captureError(error, { flow: 'forum_post', collectionId: collection.id, source })
  } finally {
    posting.delete(collection.id)
  }
}

// builder-server's "already has a topic" check isn't atomic: recovering while the publishing tab may still be
// posting could open a second topic, so recovery waits until that tab's post is long done.
const RECOVERY_GRACE_MS = 15 * 60_000

/**
 * The topic is created by the publishing tab; if that tab closed first, the next owner or collaborator to open the
 * synced collection while it waits for its first approval creates it, once per tab.
 */
export function useForumPostRecovery(address: string | undefined, collection: Collection | undefined, items: Item[]) {
  const queryClient = useQueryClient()
  const synced = useMemo(() => items.length > 0 && items.every(item => item.tokenId), [items])
  const needsPost =
    !!collection &&
    collection.isPublished &&
    !collection.isApproved &&
    !collection.forumLink &&
    synced &&
    Date.now() - collection.updatedAt > RECOVERY_GRACE_MS &&
    canManageCollectionItems(collection, address)

  useEffect(() => {
    if (!needsPost || !address || !collection || recovered.has(collection.id)) return
    recovered.add(collection.id)
    void postCollectionToForum(queryClient, address, collection, 'recovery')
    // Keyed on the id: a refetched collection object must not post twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPost, address, collection?.id, queryClient])
}

/** Tells the forum topic who the collection was assigned to; the assignment itself never depends on it. */
export async function postAssigneeToForum(
  queryClient: QueryClient,
  address: string,
  collection: Collection,
  assignee: string | null
): Promise<void> {
  if (!collection.forumLink) return
  try {
    const profile = assignee ? await queryClient.fetchQuery(profileQuery(assignee)).catch(() => undefined) : undefined
    // Unclaimed names are free text, so only a claimed one may stand for the curator (as builder-server does).
    const name = profile?.hasClaimedName ? profile.name : undefined
    await createCurationForumReply(address, collection.id, { raw: buildAssigneeReply(assignee, name) })
  } catch (error) {
    track('Assignee forum post error', { collectionId: collection.id, error: errorCode(error) })
    captureError(error, { flow: 'forum_post', collectionId: collection.id, step: 'assignee' })
  }
}
