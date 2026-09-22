import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setErrorForwarder } from '~/lib/monitoring'
import { createQueryClient } from './queryClient'

const reported = vi.fn()

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  setErrorForwarder(reported)
})

afterEach(() => {
  setErrorForwarder(null)
  reported.mockReset()
  vi.restoreAllMocks()
})

describe('createQueryClient', () => {
  it('reports a query that fails by name, keeping the ids and search text in its key out of the report', async () => {
    const client = createQueryClient()

    await client
      .fetchQuery({
        queryKey: ['collections', '0xabc', 1, 'my secret drop'],
        queryFn: () => Promise.reject(new Error('503')),
        retry: false
      })
      .catch(() => undefined)

    expect(reported).toHaveBeenCalledWith(
      expect.objectContaining({ message: '503' }),
      expect.objectContaining({ flow: 'query', query_key: 'collections' })
    )
    expect(JSON.stringify(reported.mock.calls[0][1])).not.toContain('my secret drop')
  })

  it('does not report a query whose signer call the creator rejected', async () => {
    const client = createQueryClient()

    await client
      .fetchQuery({
        queryKey: ['mana-allowance', '0xabc'],
        queryFn: () => Promise.reject(Object.assign(new Error('User rejected the request'), { code: 4001 })),
        retry: false
      })
      .catch(() => undefined)

    expect(reported).not.toHaveBeenCalled()
  })

  it('reports a mutation that fails', async () => {
    const client = createQueryClient()
    const mutation = client.getMutationCache().build(client, {
      mutationKey: ['save-collection'],
      mutationFn: () => Promise.reject(new Error('reverted'))
    })

    await mutation.execute(undefined).catch(() => undefined)

    expect(reported).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'reverted' }),
      expect.objectContaining({ flow: 'mutation', mutation_key: 'save-collection' })
    )
  })

  it('reports a mutation without a key with no name rather than a made-up one', async () => {
    const client = createQueryClient()
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(new Error('reverted'))
    })

    await mutation.execute(undefined).catch(() => undefined)

    expect(reported).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'reverted' }),
      expect.objectContaining({ flow: 'mutation', mutation_key: undefined })
    )
  })

  it('does not report the creator dismissing the wallet prompt', async () => {
    const client = createQueryClient()
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(Object.assign(new Error('User rejected the request'), { code: 4001 }))
    })

    await mutation.execute(undefined).catch(() => undefined)

    expect(reported).not.toHaveBeenCalled()
  })
})
