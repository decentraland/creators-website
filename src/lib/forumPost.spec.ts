import { describe, expect, it, vi } from 'vitest'
import { BuilderServerError } from './builder'
import { type Collection } from './collections'
import {
  buildAssigneeReply,
  buildCollectionForumPost,
  createCollectionForumPost,
  getForumTopicId,
  type ForumPost
} from './forumPost'
import { ItemType, type Item } from './items'

const OWNER = '0x00000000000000000000000000000000000000aa'
const CONTRACT = '0x1234567890abcdef1234567890abcdef12345678'

const collection: Collection = {
  id: 'col-1',
  name: 'Halloween',
  owner: OWNER,
  contractAddress: CONTRACT,
  urn: 'urn:decentraland:amoy:collections-v2:' + CONTRACT,
  isPublished: true,
  isApproved: false,
  itemCount: 1,
  minters: [],
  managers: [],
  createdAt: 1,
  updatedAt: 1
}

const item: Item = {
  id: 'item-1',
  name: 'Pumpkin hat',
  description: 'Spooky',
  thumbnail: 'thumbnail.png',
  owner: OWNER,
  collectionId: collection.id,
  rarity: 'epic',
  isPublished: true,
  isApproved: false,
  inCatalyst: false,
  type: ItemType.WEARABLE,
  data: { category: 'hat', representations: [] },
  contents: { 'thumbnail.png': 'thumb-hash' },
  createdAt: 1,
  updatedAt: 1
}

const post: ForumPost = { title: 'Collection ready', raw: 'body' }

describe('buildCollectionForumPost', () => {
  it('announces the collection by its publisher name, linking the collection and each item in this app', () => {
    const { title, raw } = buildCollectionForumPost(collection, [item], 'Ana', 'https://decentraland.org/create')

    expect(title).toBe("Collection 'Halloween' created by Ana is ready for review!")
    expect(raw).toContain(
      '[View entire collection](https://decentraland.org/create/collections/editor?collection=col-1)'
    )
    expect(raw).toContain('**Pumpkin hat**')
    expect(raw).toContain('- Description: Spooky\n- Rarity: epic\n- Category: hat')
    expect(raw).toContain('/storage/contents/thumb-hash)')
    expect(raw).toContain('(https://decentraland.org/create/collections/editor?collection=col-1&item=item-1)')
  })

  it('falls back to the shortened owner address when the publisher has no name', () => {
    const { title } = buildCollectionForumPost(collection, [item], undefined, 'http://localhost:5173')

    expect(title).toBe("Collection 'Halloween' created by 0x0000...000aa is ready for review!")
  })
})

describe('buildAssigneeReply', () => {
  it('links the assignee profile by name, or names the address, or says it was unassigned', () => {
    expect(buildAssigneeReply(OWNER, 'Curator')).toMatch(
      /assigned to <a .*href=".*\/profile\/accounts\/0x0+aa">Curator<\/a>/
    )
    expect(buildAssigneeReply(OWNER)).toBe(`The collection has been assigned to ${OWNER}`)
    expect(buildAssigneeReply(null)).toBe('The collection has been unassigned.')
  })
})

describe('getForumTopicId', () => {
  it('reads the topic id at the end of the forum link', () => {
    expect(getForumTopicId('https://forum.decentraland.org/t/collection-halloween/12345')).toBe(12345)
    expect(getForumTopicId(undefined)).toBeNull()
    expect(getForumTopicId('https://forum.decentraland.org/t/no-id')).toBeNull()
  })
})

describe('createCollectionForumPost', () => {
  const serverError = (data: unknown) => new BuilderServerError('Error creating forum post', 500, data)

  it('answers the new topic link', async () => {
    const createPost = vi.fn().mockResolvedValue('https://forum/t/x/1')

    await expect(createCollectionForumPost(collection, post, { createPost }, 0, 0)).resolves.toBe('https://forum/t/x/1')
    expect(createPost).toHaveBeenCalledWith('col-1', post)
  })

  it('does not post again for a collection that already has a topic', async () => {
    const createPost = vi.fn()

    await expect(
      createCollectionForumPost({ ...collection, forumLink: 'https://forum/t/x/1' }, post, { createPost })
    ).resolves.toBeNull()
    expect(createPost).not.toHaveBeenCalled()
  })

  it('treats a topic created meanwhile as done', async () => {
    const createPost = vi
      .fn()
      .mockRejectedValue(new BuilderServerError('Forum post already exists', 500, { id: 'col-1' }))

    await expect(createCollectionForumPost(collection, post, { createPost }, 3, 0)).resolves.toBeNull()
    expect(createPost).toHaveBeenCalledTimes(1)
  })

  it('appends the contract address when the title is taken', async () => {
    const createPost = vi
      .fn()
      .mockRejectedValueOnce(serverError({ errors: 'Error creating the post: Title has already been used' }))
      .mockResolvedValue('https://forum/t/x/2')

    await expect(createCollectionForumPost(collection, post, { createPost }, 0, 0)).resolves.toBe('https://forum/t/x/2')
    expect(createPost).toHaveBeenLastCalledWith('col-1', { ...post, title: 'Collection ready 0x1234...45678' })
  })

  it('retries a failing post a limited number of times, then gives up', async () => {
    const createPost = vi.fn().mockRejectedValue(serverError({ errors: 'timeout' }))

    await expect(createCollectionForumPost(collection, post, { createPost }, 2, 0)).rejects.toBeInstanceOf(
      BuilderServerError
    )
    expect(createPost).toHaveBeenCalledTimes(3)
  })
})
