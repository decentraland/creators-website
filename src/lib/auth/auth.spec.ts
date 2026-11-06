import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Authenticator, type AuthIdentity, type AuthLink } from '@dcl/crypto'
import { localStorageStoreIdentity, localStorageClearIdentity } from '@dcl/single-sign-on-client'
import { ProviderType } from '@dcl/schemas'
import { TEST_PRIVATE_KEY, TEST_SIGNER } from '~/test/chain'
import { createAuthHeaders, createEphemeralIdentity, getIdentity, isSocialLogin, logout, signedFetch } from './auth'

vi.mock('decentraland-connect', () => ({
  connection: { disconnect: vi.fn().mockResolvedValue(undefined) }
}))

async function makeStoredIdentity(): Promise<{ address: string; identity: AuthIdentity }> {
  const owner = privateKeyToAccount(generatePrivateKey())
  const ephemeralKey = generatePrivateKey()
  const ephemeral = privateKeyToAccount(ephemeralKey)
  const identity = await Authenticator.initializeAuthChain(
    owner.address,
    {
      address: ephemeral.address,
      publicKey: ephemeral.publicKey,
      privateKey: ephemeralKey
    },
    600,
    message => owner.signMessage({ message })
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

  it('signedFetch signs the caller metadata along and sends it verbatim', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock

    await signedFetch(
      address,
      'https://marketplace.example',
      '/v1/trades',
      { method: 'POST' },
      { signer: 'dcl:builder', intent: 'dcl:create-trade' }
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(JSON.parse(headers['x-identity-metadata'])).toEqual({ signer: 'dcl:builder', intent: 'dcl:create-trade' })
    const chain = parseAuthChain(headers)
    expect(chain[chain.length - 1].payload).toBe(
      `post:/v1/trades:${headers['x-identity-timestamp']}:${headers['x-identity-metadata']}`.toLowerCase()
    )
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

  // The auth chain stores these strings as they are: their format is what servers and other dapps parse.
  it('createEphemeralIdentity answers the checksummed address and the uncompressed public key of its key', async () => {
    await expect(createEphemeralIdentity(TEST_PRIVATE_KEY)).resolves.toEqual({
      address: TEST_SIGNER,
      publicKey:
        '0x044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1',
      privateKey: TEST_PRIVATE_KEY
    })
    const fresh = await createEphemeralIdentity()
    expect(fresh.privateKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(fresh.publicKey).toMatch(/^0x04[0-9a-f]{128}$/)
    expect(fresh.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('isSocialLogin is true only for Magic-backed sessions', () => {
    expect(isSocialLogin({ providerType: ProviderType.MAGIC })).toBe(true)
    expect(isSocialLogin({ providerType: ProviderType.MAGIC_TEST })).toBe(true)
    expect(isSocialLogin({ providerType: ProviderType.INJECTED })).toBe(false)
    expect(isSocialLogin({ providerType: ProviderType.WALLET_CONNECT_V2 })).toBe(false)
  })
})
