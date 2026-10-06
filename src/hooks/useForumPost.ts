import { useEffect, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { createCollectionForumPost, createCurationForumReply, fetchAllCollectionItems } from '~/lib/builder'
import { canManageCollectionItems, type Collection } from '~/lib/collections'
import {
  buildAssigneeReply,
  buildCollectionForumPost,
  createCollectionForumPost as createTopic,
  getForumTopicId
} from '~/lib/forumPost'
import { type Item } from '~/lib/items'
import { captureError } from '~/lib/monitoring'
import { profileQuery } from '~/hooks/useProfile'

export type ForumPostSource = 'publish' | 'recovery'

// Collections whose topic is being created in this tab, so the publish path and the recovery never both post.
const posting = new Set<string>()

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
    const [items, owner] = await Promise.all([
      fetchAllCollectionItems(address, collection.id),
      queryClient.fetchQuery(profileQuery(collection.owner)).catch(() => undefined)
    ])
    const post = buildCollectionForumPost(collection, items, owner?.name)
    const forumLink = await createTopic(collection, post, {
      createPost: (collectionId, forumPost) => createCollectionForumPost(address, collectionId, forumPost)
    })
    if (forumLink) {
      track('Create forum post', { collectionId: collection.id, source })
      queryClient.setQueryData<Collection>(['collection', address, collection.id], current =>
        current ? { ...current, forumLink } : current
      )
    }
    void queryClient.invalidateQueries({ queryKey: ['collection', address, collection.id] })
  } catch (error) {
    track('Create forum post error', { collectionId: collection.id, source, error: errorCode(error) })
    captureError(error, { flow: 'forum_post', collectionId: collection.id, source })
  } finally {
    posting.delete(collection.id)
  }
}

/**
 * The topic is created by the publishing tab; if that tab closed first, the next owner or collaborator
 * to open the synced collection while it waits for its first approval creates it.
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
    canManageCollectionItems(collection, address)

  useEffect(() => {
    if (!needsPost || !address || !collection) return
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
  const topicId = getForumTopicId(collection.forumLink)
  if (!topicId) return
  try {
    const profile = assignee ? await queryClient.fetchQuery(profileQuery(assignee)).catch(() => undefined) : undefined
    await createCurationForumReply(address, collection.id, {
      topic_id: topicId,
      raw: buildAssigneeReply(assignee, profile?.name)
    })
  } catch (error) {
    track('Assignee forum post error', { collectionId: collection.id, error: errorCode(error) })
    captureError(error, { flow: 'forum_post', collectionId: collection.id, step: 'assignee' })
  }
}
