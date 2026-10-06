// The collection's Discourse topic on the Decentraland forum: the creator ↔ curation committee channel, ported
// from the legacy builder (modules/forum). builder-server writes the topic itself; replies are posted in English.
import { config } from '~/config'
import { BuilderServerError } from '~/lib/builder'
import { toSafeLink } from '~/lib/collections'

/** The reply posted on the topic when a curator is assigned (or the collection is unassigned). */
export function buildAssigneeReply(assignee: string | null, assigneeName?: string): string {
  if (!assignee) return 'The collection has been unassigned.'
  if (!assigneeName) return `The collection has been assigned to ${assignee}`
  const profileUrl = `${config.get('SITES_URL')}/profile/accounts/${assignee}`
  return `The collection has been assigned to <a target="_blank" href="${profileUrl}">${assigneeName}</a>`
}

const CONFLICT = 409

// The server checks publication against the subgraph, which can lag behind the sync that triggered the post.
const isNotPublishedYet = (error: BuilderServerError) =>
  error.status === CONFLICT && error.message.includes('not published')

const isRetryable = (error: unknown) =>
  !(error instanceof BuilderServerError) || error.status >= 500 || isNotPublishedYet(error)

const existingLink = (error: unknown) =>
  error instanceof BuilderServerError && error.status === CONFLICT
    ? toSafeLink((error.data as { forum_link?: string } | undefined)?.forum_link ?? null)
    : undefined

export type CreateForumPostDeps = { createPost: (collectionId: string) => Promise<string> }

const RETRIES = 3
const RETRY_DELAY_MS = 5000

/**
 * Asks builder-server to open the collection's topic and answers its link, including one that already existed.
 * Network errors, 5xx and a publication the server can't see yet are retried briefly; anything else throws.
 */
export async function createCollectionForumPost(
  collectionId: string,
  deps: CreateForumPostDeps,
  retries = RETRIES,
  retryDelayMs = RETRY_DELAY_MS
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await deps.createPost(collectionId)
    } catch (error) {
      const link = existingLink(error)
      if (link) return link
      if (!isRetryable(error) || attempt >= retries) throw error
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * 2 ** attempt))
    }
  }
}
