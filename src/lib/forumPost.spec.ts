import { describe, expect, it, vi } from 'vitest'
import { BuilderServerError } from './builder'
import { buildAssigneeReply, createCollectionForumPost } from './forumPost'

const ASSIGNEE = '0x00000000000000000000000000000000000000aa'
const LINK = 'https://forum.decentraland.org/t/hats/77'

describe('buildAssigneeReply', () => {
  it('links the assignee profile by name, or names the address, or says it was unassigned', () => {
    expect(buildAssigneeReply(ASSIGNEE, 'Curator')).toMatch(
      /assigned to <a .*href=".*\/profile\/accounts\/0x0+aa">Curator<\/a>/
    )
    expect(buildAssigneeReply(ASSIGNEE)).toBe(`The collection has been assigned to ${ASSIGNEE}`)
    expect(buildAssigneeReply(null)).toBe('The collection has been unassigned.')
  })
})

describe('createCollectionForumPost', () => {
  it('answers the new topic link', async () => {
    const createPost = vi.fn().mockResolvedValue(LINK)

    await expect(createCollectionForumPost('c1', { createPost }, 0, 0)).resolves.toBe(LINK)
    expect(createPost).toHaveBeenCalledWith('c1')
  })

  it('answers the link of a topic that already existed', async () => {
    const createPost = vi
      .fn()
      .mockRejectedValue(new BuilderServerError('Forum post already exists', 409, { id: 'c1', forum_link: LINK }))

    await expect(createCollectionForumPost('c1', { createPost }, 3, 0)).resolves.toBe(LINK)
    expect(createPost).toHaveBeenCalledTimes(1)
  })

  it('retries while the server cannot see the publication yet, or fails transiently', async () => {
    const createPost = vi
      .fn()
      .mockRejectedValueOnce(new BuilderServerError('The collection is not published', 409, { id: 'c1' }))
      .mockRejectedValueOnce(new BuilderServerError('Error creating forum post', 500))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(LINK)

    await expect(createCollectionForumPost('c1', { createPost }, 3, 0)).resolves.toBe(LINK)
    expect(createPost).toHaveBeenCalledTimes(4)
  })

  it('gives up after a few retries', async () => {
    const createPost = vi.fn().mockRejectedValue(new BuilderServerError('Error creating forum post', 500))

    await expect(createCollectionForumPost('c1', { createPost }, 2, 0)).rejects.toBeInstanceOf(BuilderServerError)
    expect(createPost).toHaveBeenCalledTimes(3)
  })

  it('fails fast on errors a retry cannot fix', async () => {
    const createPost = vi.fn().mockRejectedValue(new BuilderServerError('Unauthorized', 401))

    await expect(createCollectionForumPost('c1', { createPost }, 3, 0)).rejects.toBeInstanceOf(BuilderServerError)
    expect(createPost).toHaveBeenCalledTimes(1)
  })
})
