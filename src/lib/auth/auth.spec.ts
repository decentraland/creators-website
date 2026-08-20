import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { ethers } from 'ethers'
import { Authenticator, type AuthIdentity, type AuthLink } from '@dcl/crypto'
import { localStorageStoreIdentity, localStorageClearIdentity } from '@dcl/single-sign-on-client'
import { createAuthHeaders, getIdentity, signedFetch } from './auth'

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

  it('createAuthHeaders signs the lowercased method:path payload as an auth chain', () => {
    const headers = createAuthHeaders(address, 'GET', `/${address}/collections`)
    const chain = parseAuthChain(headers)
    expect(chain.length).toBeGreaterThanOrEqual(2)
    // The last link carries the signed payload builder-server verifies.
    expect(chain[chain.length - 1].payload).toBe(`get:/${address}/collections`)
  })

  it('createAuthHeaders returns no headers without a stored identity', () => {
    expect(createAuthHeaders('0x0000000000000000000000000000000000000000', 'GET', '/x')).toEqual({})
  })

  it('signedFetch signs the path without its query string and fetches the full URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock

    await signedFetch(address, 'https://builder-api.example/v1', `/${address}/collections?page=1&limit=20`)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://builder-api.example/v1/${address}/collections?page=1&limit=20`)
    const chain = parseAuthChain(init.headers as Record<string, string>)
    expect(chain[chain.length - 1].payload).toBe(`get:/${address}/collections`)
  })

  it('signedFetch sends no auth headers when there is no address', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock

    await signedFetch(undefined, 'https://builder-api.example/v1', '/collections')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(Object.keys(init.headers as Record<string, string>)).toHaveLength(0)
  })
})
