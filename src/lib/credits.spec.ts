import { afterEach, describe, expect, it, vi } from 'vitest'
import { signedFetch } from './auth'
import { CreditsServerError, authorizePublication, fetchCreditsBalance } from './credits'

vi.mock('./auth', () => ({ signedFetch: vi.fn() }))

const ADDRESS = '0x00000000000000000000000000000000000000aa'
const mockedFetch = vi.mocked(signedFetch)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => mockedFetch.mockReset())

describe('fetchCreditsBalance', () => {
  it('reads the USD block of the credits response with an ADR-44 signed request', async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse({ credits: [], totalCredits: '0', usd: { balanceCents: 5600, credits: 560 } })
    )
    await expect(fetchCreditsBalance(ADDRESS)).resolves.toEqual({ credits: 560, balanceCents: 5600 })
    const [address, baseUrl, path, , options] = mockedFetch.mock.calls[0]
    expect(address).toBe(ADDRESS)
    expect(baseUrl).toBe('https://credits.decentraland.zone')
    expect(path).toBe(`/users/${ADDRESS}/credits`)
    expect(options).toEqual({ scheme: 'adr44' })
  })

  it('treats a missing USD block as an empty balance', async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ credits: [], totalCredits: '0' }))
    await expect(fetchCreditsBalance(ADDRESS)).resolves.toEqual({ credits: 0, balanceCents: 0 })
  })

  it('surfaces server failures as CreditsServerError', async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ error: 'nope' }, 500))
    await expect(fetchCreditsBalance(ADDRESS)).rejects.toBeInstanceOf(CreditsServerError)
  })
})

describe('authorizePublication', () => {
  const params = {
    usdPriceCents: 3000,
    chainId: 80002,
    creditsManagerAddress: '0x8052a560e6e6ac86eeb7e711a4497f639b322fb3',
    externalCall: { target: '0x1', selector: '0x12345678', data: '0x', expiresAt: 1, salt: '0x2' }
  }
  const authorization = {
    credit: { id: '0x01', amount: '3000000000000000000000', expiresAt: '99', signature: '0xsig' },
    externalCallSignature: '0xext'
  }

  it('posts the fee and external call and returns the signed credit', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(authorization))
    await expect(authorizePublication(ADDRESS, params)).resolves.toEqual(authorization)
    const [, , path, init] = mockedFetch.mock.calls[0]
    expect(path).toBe('/credits/authorize-publication')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual(params)
  })

  it('flags a 402 as insufficient credits', async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse({ error: 'Insufficient credits', balanceCents: 100, requiredCents: 3000 }, 402)
    )
    await expect(authorizePublication(ADDRESS, params)).rejects.toMatchObject({
      name: 'CreditsServerError',
      code: 'insufficient_credits'
    })
  })

  it('rejects an incomplete authorization instead of sending a broken transaction', async () => {
    mockedFetch.mockResolvedValue(jsonResponse({ credit: { id: '0x01' } }))
    await expect(authorizePublication(ADDRESS, params)).rejects.toThrow(/incomplete/)
  })
})
