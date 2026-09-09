import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { ethers } from 'ethers'
import { Authenticator, type AuthIdentity, type AuthLink } from '@dcl/crypto'
import { localStorageStoreIdentity, localStorageClearIdentity } from '@dcl/single-sign-on-client'
import { createAuthHeaders, getIdentity, logout, signedFetch } from './auth'

vi.mock('decentraland-connect', () => ({
  connection: { disconnect: vi.fn().mockResolvedValue(undefined) }
}))

async function makeStoredIdentity(): Promise<{ address: string; identity: AuthIdentity }> {
  const owner = ethers.Wallet.createRandom()
  const ephemeral = ethers.Wallet.createRandom()
  const identity = await Authenticator.initializeAuthChain(
    owner.address,
    {
      address: ephemeral.address,
      publicKey: ethers.utils.hexlify(ephemeral.publicKey),
      privateKey: ethers.utils.hexlify(ephemeral.privateKey)
    },
    600,
    message => owner.signMessage(message)
  )
  const address = owner.address.toLowerCase()
  localStorageStoreIdentity(address, identity)
  return { address, identity }
}

function parseAuthChain(headers: Record<string, string>): AuthLink[] {
  return Object.keys(headers)
    .filter(key => key.startsWith('x-identity-auth-chain-'))
    .sort()
    .map(key => JSON.parse(headers[key]) as AuthLink)
}

describe('auth', () => {
  let address: string

  beforeAll(async () => {
    ;({ address } = await makeStoredIdentity())
  })

  afterAll(() => {
    localStorageClearIdentity(address)
  })

  it('getIdentity returns the stored identity regardless of address casing', () => {
    expect(getIdentity(address)).not.toBeNull()
    expect(getIdentity(address.toUpperCase().replace('0X', '0x'))).not.toBeNull()
    expect(getIdentity('0x0000000000000000000000000000000000000000')).toBeNull()
  })

  it('createAuthHeaders signs the ADR-44 payload and sends the timestamp and metadata it used', () => {
    const headers = createAuthHeaders(address, 'GET', `/v1/${address}/collections`)
    const chain = parseAuthChain(headers)
    expect(chain.length).toBeGreaterThanOrEqual(2)
    // The last link carries the signed payload the server rebuilds from method, path and these headers.
    expect(chain[chain.length - 1].payload).toBe(
      `get:/v1/${address}/collections:${headers['x-identity-timestamp']}:${headers['x-identity-metadata']}`
    )
    expect(Number(headers['x-identity-timestamp'])).toBeGreaterThan(0)
    expect(JSON.parse(headers['x-identity-metadata'])).toEqual({})
  })

  it('createAuthHeaders returns no headers without a stored identity', () => {
    expect(createAuthHeaders('0x0000000000000000000000000000000000000000', 'GET', '/x')).toEqual({})
  })

  it('signedFetch signs the full pathname without its query string and fetches the full URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock

    await signedFetch(address, 'https://builder-api.example/v1', `/${address}/collections?page=1&limit=20`)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://builder-api.example/v1/${address}/collections?page=1&limit=20`)
    const headers = init.headers as Record<string, string>
    const chain = parseAuthChain(headers)
    expect(chain[chain.length - 1].payload).toBe(`get:/v1/${address}/collections:${headers['x-identity-timestamp']}:{}`)
  })

  it('logout clears the stored identity so it cannot outlive a sign-out', async () => {
    const { address: other } = await makeStoredIdentity()
    expect(getIdentity(other)).not.toBeNull()

    await logout(other)

    expect(getIdentity(other)).toBeNull()
  })

  it('signedFetch sends no auth headers when there is no address', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock

    await signedFetch(undefined, 'https://builder-api.example/v1', '/collections')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(Object.keys(init.headers as Record<string, string>)).toHaveLength(0)
  })
})
