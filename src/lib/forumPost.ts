// The collection's Discourse topic on the Decentraland forum: the creator ↔ curation committee channel,
// ported from the legacy builder (modules/forum). Posts are always in English, like the legacy ones.
import { basePath, config } from '~/config'
import { BuilderServerError, getContentsStorageUrl } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'

export type ForumPost = { title: string; raw: string }

// ASCII on purpose: builder-server strips a range of symbols from titles that includes "…".
const shorten = (address: string) => `${address.slice(0, 6)}...${address.slice(-5)}`

const appUrl = () => `${window.location.origin}${basePath ?? ''}`

function editorUrl(baseUrl: string, params: { collection: string; item?: string }): string {
  return `${baseUrl}/collections/editor?${new URLSearchParams(params).toString()}`
}

function toRawItem(item: Item, collectionId: string, baseUrl: string): string {
  const sections: string[] = []
  if (item.description) sections.push(`- Description: ${item.description}`)
  if (item.rarity) sections.push(`- Rarity: ${item.rarity}`)
  if (item.data.category) sections.push(`- Category: ${item.data.category}`)
  return `**${item.name}**
${sections.join('\n')}
![](${getContentsStorageUrl(item.contents[item.thumbnail])})
[Link to editor](${editorUrl(baseUrl, { collection: collectionId, item: item.id })})`
}

/** The "ready for review" topic opened when a collection is published; `ownerName` is the publisher's profile name, `baseUrl` this app's root. */
export function buildCollectionForumPost(
  collection: Collection,
  items: Item[],
  ownerName?: string,
  baseUrl = appUrl()
): ForumPost {
  return {
    title: `Collection '${collection.name}' created by ${ownerName || shorten(collection.owner)} is ready for review!`,
    raw: `# ${collection.name}

[View entire collection](${editorUrl(baseUrl, { collection: collection.id })})

## Wearables

${items.map(item => toRawItem(item, collection.id, baseUrl)).join('\n\n')}`
  }
}

/** The reply posted on the topic when a curator is assigned (or the collection is unassigned). */
export function buildAssigneeReply(assignee: string | null, assigneeName?: string): string {
  if (!assignee) return 'The collection has been unassigned.'
  if (!assigneeName) return `The collection has been assigned to ${assignee}`
  const profileUrl = `${config.get('SITES_URL')}/profile/accounts/${assignee}`
  return `The collection has been assigned to <a target="_blank" href="${profileUrl}">${assigneeName}</a>`
}

/** The Discourse topic id: the last segment of `forum_link` (`…/t/<slug>/<id>`). */
export function getForumTopicId(forumLink: string | undefined): number | null {
  const id = Number(forumLink?.split('/').pop())
  return Number.isInteger(id) && id > 0 ? id : null
}

const errorText = (error: BuilderServerError) => `${error.message} ${JSON.stringify(error.data ?? '')}`
const isDuplicateTitle = (error: unknown) =>
  error instanceof BuilderServerError && errorText(error).includes('Title has already been used')
const isAlreadyPosted = (error: unknown) =>
  error instanceof BuilderServerError && errorText(error).includes('Forum post already exists')

export type CreateForumPostDeps = { createPost: (collectionId: string, post: ForumPost) => Promise<string> }

const RETRIES = 5
const RETRY_DELAY_MS = 5000

/**
 * Opens the collection's topic and answers its link, or `null` when the collection already had one
 * (the caller should refetch it). A taken title is retried once with the contract address appended;
 * anything else is retried a few times with backoff, then thrown.
 */
export async function createCollectionForumPost(
  collection: Collection,
  post: ForumPost,
  deps: CreateForumPostDeps,
  retries = RETRIES,
  retryDelayMs = RETRY_DELAY_MS
): Promise<string | null> {
  if (collection.forumLink) return null
  let current = post
  for (let attempt = 0; ; attempt++) {
    try {
      return await deps.createPost(collection.id, current)
    } catch (error) {
      if (isAlreadyPosted(error)) return null
      if (isDuplicateTitle(error) && current === post && collection.contractAddress) {
        current = { ...post, title: `${post.title} ${shorten(collection.contractAddress)}` }
        continue
      }
      if (attempt >= retries) throw error
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * 2 ** attempt))
    }
  }
}
