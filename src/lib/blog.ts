// Read-only client for the latest blog posts on the Contentful-backed CMS API ("Fresh from the blog").
import { config } from '~/config'
import { captureError } from '~/lib/monitoring'

type CMSLink = { sys: { id: string } }

export type CMSPostItem = {
  sys: { id: string }
  fields: {
    id: string
    title: string
    publishedDate?: string
    image?: CMSLink
    category?: CMSLink
  }
}

export type CMSPostsResponse = { items: CMSPostItem[]; total?: number }

export type CMSCategoryItem = { sys: { id: string }; fields: { id: string; title: string } }

export type CMSCategoriesResponse = { items: CMSCategoryItem[] }

export type CMSAssetResponse = { fields: { file: { url: string } } }

export type BlogPost = {
  id: string
  title: string
  publishedDate: string | null
  categoryTitle: string | null
  imageUrl: string | null
  url: string
}

const POSTS_LIMIT = 3
const FETCH_TIMEOUT_MS = 10_000

const cmsUrl = () =>
  `${config.get('CMS_API_URL')}/spaces/${config.get('CONTENTFUL_SPACE_ID')}/environments/${config.get('CONTENTFUL_ENVIRONMENT')}`

export const blogUrl = () => `${config.get('SITES_URL')}/blog`

/** A post's page; posts without a category have no page of their own, so they link to the blog search. */
export function postUrl(post: { title: string; slug: string; categorySlug: string | null }): string {
  return post.categorySlug
    ? `${blogUrl()}/${post.categorySlug}/${post.slug}`
    : `${blogUrl()}/search?q=${encodeURIComponent(post.title)}`
}

// Contentful serves asset files behind protocol-relative URLs.
export const normalizeAssetUrl = (url: string) => (url.startsWith('//') ? `https:${url}` : url)

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) {
      await response.body?.cancel()
      return null
    }
    return (await response.json()) as T
  } catch (error) {
    // Degrades the card, but a CMS outage or schema change must still surface in monitoring.
    captureError(error, { flow: 'blog' })
    return null
  }
}

/** Joins posts with their category slug/title and resolved cover image. Posts missing an id, slug or title are dropped. */
export function buildBlogPosts(
  posts: CMSPostItem[],
  categories: CMSCategoriesResponse | null,
  assetUrlById: Map<string, string>
): BlogPost[] {
  const categoryById = new Map<string, { slug: string; title: string }>()
  for (const category of categories?.items ?? []) {
    if (category.sys?.id && category.fields?.id) {
      categoryById.set(category.sys.id, { slug: category.fields.id, title: category.fields.title })
    }
  }
  const built: BlogPost[] = []
  for (const post of posts) {
    const slug = post.fields?.id
    if (!post.sys?.id || !slug || !post.fields.title) continue
    const category = post.fields.category?.sys.id ? categoryById.get(post.fields.category.sys.id) : undefined
    const assetId = post.fields.image?.sys.id
    const rawImageUrl = assetId ? assetUrlById.get(assetId) : undefined
    built.push({
      id: post.sys.id,
      title: post.fields.title,
      publishedDate: post.fields.publishedDate ?? null,
      categoryTitle: category?.title ?? null,
      imageUrl: rawImageUrl ? normalizeAssetUrl(rawImageUrl) : null,
      url: postUrl({ title: post.fields.title, slug, categorySlug: category?.slug ?? null })
    })
  }
  return built
}

/** The three newest posts. A failing posts request throws; a missing category list or image degrades the card instead. */
export async function fetchLatestBlogPosts(): Promise<BlogPost[]> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const base = cmsUrl()
  const [posts, categories] = await Promise.all([
    fetchJson<CMSPostsResponse>(`${base}/blog/posts?limit=${POSTS_LIMIT}`, signal),
    fetchJson<CMSCategoriesResponse>(`${base}/blog/categories`, signal)
  ])
  if (!posts) throw new Error('blog posts request failed')
  if (!Array.isArray(posts.items) || posts.items.length === 0) return []

  const assetIds = posts.items.map(post => post.fields?.image?.sys.id).filter((id): id is string => Boolean(id))
  const assets = await Promise.all(assetIds.map(id => fetchJson<CMSAssetResponse>(`${base}/assets/${id}`, signal)))
  const assetUrlById = new Map<string, string>()
  assetIds.forEach((id, index) => {
    const fileUrl = assets[index]?.fields?.file?.url
    if (fileUrl) assetUrlById.set(id, fileUrl)
  })
  return buildBlogPosts(posts.items, categories, assetUrlById)
}
