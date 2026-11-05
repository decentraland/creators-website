import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { BuilderServerError } from './transport'
import {
  ValidationLimitError,
  appealCollectionCuration,
  fetchCollectionEvents,
  requestCollectionValidation
} from './review'

vi.mock('~/lib/auth', () => ({
  signedFetch: vi.fn()
}))

import { signedFetch } from '~/lib/auth'
import { ADDRESS, jsonResponse, okResponse } from '~/test/builderServer'

const signedFetchMock = signedFetch as Mock

beforeEach(() => {
  signedFetchMock.mockReset()
})

describe('collection events and review requests', () => {
  it('lists the timeline page and maps the rows', async () => {
    signedFetchMock.mockResolvedValue(
      okResponse({
        results: [
          {
            id: 'e1',
            collection_id: 'a1b2',
            type: 'review.ai_started',
            actor: 'validator',
            actor_address: null,
            payload: { trigger: 'publish' },
            created_at: '2026-09-29T10:00:00Z'
          }
        ],
        total: 1,
        pages: 1,
        page: 2,
        limit: 20
      })
    )
    const page = await fetchCollectionEvents(ADDRESS, 'a1b2', { page: 2, limit: 20 })
    expect(signedFetchMock.mock.calls[0][2]).toBe('/collections/a1b2/events?page=2&limit=20')
    expect(page.total).toBe(1)
    expect(page.results[0]).toMatchObject({ type: 'review.ai_started', payload: { trigger: 'publish' } })
  })

  it('asks for another automatic review', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    await requestCollectionValidation(ADDRESS, 'a1b2')
    expect(signedFetchMock.mock.calls[0][2]).toBe('/collections/a1b2/validations')
    expect(signedFetchMock.mock.calls[0][3]).toMatchObject({ method: 'POST' })
  })

  it('turns the daily limit into an error carrying when to retry', async () => {
    signedFetchMock.mockResolvedValue(
      jsonResponse({ ok: false, error: 'Too many attempts', data: { retryAt: '2026-09-30T00:00:00Z' } }, false, 429)
    )
    const error = await requestCollectionValidation(ADDRESS, 'a1b2').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ValidationLimitError)
    expect((error as ValidationLimitError).status).toBe(429)
    expect((error as ValidationLimitError).retryAt).toBe(Date.parse('2026-09-30T00:00:00Z'))
  })

  it('keeps a running validation as a plain 409', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: false, error: 'Running' }, false, 409))
    const error = await requestCollectionValidation(ADDRESS, 'a1b2').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BuilderServerError)
    expect(error).not.toBeInstanceOf(ValidationLimitError)
    expect((error as BuilderServerError).status).toBe(409)
  })

  it('sends the appeal note, or an empty body without one', async () => {
    signedFetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    await appealCollectionCuration(ADDRESS, 'a1b2', 'Fixed the sleeves')
    expect(signedFetchMock.mock.calls[0][2]).toBe('/collections/a1b2/curation/appeal')
    expect(signedFetchMock.mock.calls[0][3]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ note: 'Fixed the sleeves' })
    })

    await appealCollectionCuration(ADDRESS, 'a1b2')
    expect(signedFetchMock.mock.calls[1][3]).toMatchObject({ method: 'POST', body: JSON.stringify({}) })
  })
})
