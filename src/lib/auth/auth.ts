// The ONLY module allowed to import decentraland-connect, @dcl/single-sign-on-client or @dcl/crypto,
// or to hold an EIP-1193 provider (see CONVENTIONS.md, host-portability seams). Everything else uses
// the wallet store plus the helpers exported here.
import { ethers } from 'ethers'
import { ChainId, ProviderType } from '@dcl/schemas'
import { Authenticator, type AuthIdentity } from '@dcl/crypto'
import {
  localStorageClearIdentity,
  localStorageGetIdentity,
  localStorageStoreIdentity
} from '@dcl/single-sign-on-client'
import { config } from '~/config'

// ~31 days, same as the legacy builder and marketplace webapps.
const IDENTITY_EXPIRATION_MINUTES = 31 * 24 * 60

const AUTH_CHAIN_HEADER_PREFIX = 'x-identity-auth-chain-'

// decentraland-connect drags in the whole wallet-modal stack (@reown/appkit, coinbase, magic, ...).
// Load it on demand so none of that lands in the initial bundle — it's only needed to (re)connect,
// sign in, or sign out, all of which are already async.
async function getConnection() {
  return (await import('decentraland-connect')).connection
}

export type Session = {
  address: string
  chainId: number
  signer: ethers.providers.JsonRpcSigner
  web3Provider: ethers.providers.Web3Provider
  identity: AuthIdentity
  providerType: ProviderType
}

async function toSession(res: {
  account: string | null
  provider: unknown
  chainId: ChainId
  providerType: ProviderType
}): Promise<Session> {
  if (!res.account) throw new Error('No account returned by the wallet')
  const address = res.account.toLowerCase()
  // 'any' lets ethers follow wallet network changes instead of locking to the first-seen network.
  const web3Provider = new ethers.providers.Web3Provider(res.provider as ethers.providers.ExternalProvider, 'any')
  const signer = web3Provider.getSigner()

  // Reuse a valid stored identity, otherwise create one (a single wallet signature).
  let identity = localStorageGetIdentity(address)
  if (!identity) {
    const ephemeral = ethers.Wallet.createRandom()
    identity = await Authenticator.initializeAuthChain(
      address,
      {
        address: ephemeral.address,
        publicKey: ethers.utils.hexlify(ephemeral.publicKey),
        privateKey: ethers.utils.hexlify(ephemeral.privateKey)
      },
      IDENTITY_EXPIRATION_MINUTES,
      message => signer.signMessage(message)
    )
    localStorageStoreIdentity(address, identity)
  }

  return { address, chainId: res.chainId, signer, web3Provider, identity, providerType: res.providerType }
}

// Redirects to the auth app (method chooser). On return, restoreSession() rebuilds the session.
export function signInRedirect(): void {
  const redirectTo = encodeURIComponent(window.location.href)
  window.location.replace(`${config.get('AUTH_URL')}/login?redirectTo=${redirectTo}`)
}

// Silent: never asks the wallet to sign, so a visitor without a stored identity stays signed out.
export async function restoreSession(): Promise<Session | null> {
  try {
    const connection = await getConnection()
    const res = await connection.tryPreviousConnection()
    if (!res.account || !localStorageGetIdentity(res.account.toLowerCase())) return null
    return await toSession(res)
  } catch {
    return null
  }
}

export async function logout(address?: string): Promise<void> {
  try {
    const connection = await getConnection()
    await connection.disconnect()
  } catch {
    // ignore
  }
  // The ephemeral signing identity must not outlive an explicit sign-out.
  if (address) localStorageClearIdentity(address.toLowerCase())
}

export function getIdentity(address: string): AuthIdentity | null {
  return localStorageGetIdentity(address.toLowerCase())
}

const AUTH_TIMESTAMP_HEADER = 'x-identity-timestamp'
const AUTH_METADATA_HEADER = 'x-identity-metadata'

/**
 * ADR-44 signed-request headers: the auth chain signs `{method}:{path}:{timestamp}:{metadata}`
 * lowercased, and the timestamp/metadata travel as headers so the server can rebuild the payload.
 * `path` is the full URL pathname (API base included), without the query string.
 */
export function createAuthHeaders(address: string, method: string, path: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const identity = getIdentity(address)
  if (!identity) return headers
  const timestamp = String(Date.now())
  const metadata = '{}'
  const payload = `${method}:${path}:${timestamp}:${metadata}`.toLowerCase()
  const authChain = Authenticator.signPayload(identity, payload)
  for (let i = 0; i < authChain.length; i++) {
    headers[`${AUTH_CHAIN_HEADER_PREFIX}${i}`] = JSON.stringify(authChain[i])
  }
  headers[AUTH_TIMESTAMP_HEADER] = timestamp
  headers[AUTH_METADATA_HEADER] = metadata
  return headers
}

/**
 * The single signing chokepoint for server requests. `path` is relative to `baseUrl` and may carry
 * a query string; what gets signed is the resulting URL's pathname, which is what the servers verify.
 */
export async function signedFetch(
  address: string | undefined,
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const url = `${baseUrl}${path}`
  const authHeaders = address ? createAuthHeaders(address, method, new URL(url).pathname) : {}
  return fetch(url, {
    ...init,
    method,
    // Caller headers win by design (e.g. Content-Type); no caller sets x-identity-* keys.
    headers: { ...authHeaders, ...init.headers }
  })
}
