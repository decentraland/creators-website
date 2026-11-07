// The ONLY module allowed to import decentraland-connect, @dcl/single-sign-on-client or @dcl/crypto,
// or to hold an EIP-1193 provider (see CONVENTIONS.md, host-portability seams). Everything else uses
// the wallet store plus the helpers exported here.
import {
  createWalletClient,
  custom,
  type Account,
  type Address,
  type CustomTransport,
  type Hex,
  type WalletClient
} from 'viem'
import { ChainId, ProviderType } from '@dcl/schemas'
import { Authenticator, type AuthChain, type AuthIdentity } from '@dcl/crypto'
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

/** A wallet's raw EIP-1193 provider; providers without events (Magic) leave `on` out. */
export type Eip1193Provider = {
  request: (args: { method: string; params?: readonly unknown[] | object }) => Promise<unknown>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

export type Session = {
  address: string
  chainId: number
  provider: Eip1193Provider
  identity: AuthIdentity
  providerType: ProviderType
  /** The wallet behind the provider ("Trust Wallet" over WalletConnect, …), when it names itself. */
  walletName?: string
}

// Never retried: a wallet request may be a prompt, and a retry would show it again.
export function walletClientOf(
  provider: Eip1193Provider,
  address: string
): WalletClient<CustomTransport, undefined, Account> {
  return createWalletClient({ account: address as Address, transport: custom(provider, { retryCount: 0 }) })
}

/** The key pair the auth chain delegates to: a fresh random one unless `privateKey` is given. */
export async function createEphemeralIdentity(privateKey?: Hex) {
  // Only signing in needs the curve code, so it stays off the first load.
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
  const key = privateKey ?? generatePrivateKey()
  const account = privateKeyToAccount(key)
  return { address: account.address, publicKey: account.publicKey, privateKey: key }
}

async function toSession(res: {
  account: string | null
  provider: unknown
  chainId: ChainId
  providerType: ProviderType
}): Promise<Session> {
  if (!res.account) throw new Error('No account returned by the wallet')
  const address = res.account.toLowerCase()
  const provider = res.provider as Eip1193Provider

  // Reuse a valid stored identity, otherwise create one (a single wallet signature).
  let identity = localStorageGetIdentity(address)
  if (!identity) {
    const wallet = walletClientOf(provider, address)
    identity = await Authenticator.initializeAuthChain(
      address,
      await createEphemeralIdentity(),
      IDENTITY_EXPIRATION_MINUTES,
      message => wallet.signMessage({ message })
    )
    localStorageStoreIdentity(address, identity)
  }

  return { address, chainId: res.chainId, provider, identity, providerType: res.providerType }
}

/**
 * Social login (Google, Discord, Apple, email) runs through Magic, whose custodial key signs without any
 * wallet prompt. Use it to decide whether the UI must explain a pending wallet confirmation.
 */
export function isSocialLogin(session: Pick<Session, 'providerType'>): boolean {
  return session.providerType === ProviderType.MAGIC || session.providerType === ProviderType.MAGIC_TEST
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
    const session = await toSession(res)
    return { ...session, walletName: connection.getWalletName() }
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

/** Signs `payload` (a Catalyst entity id) with the wallet's ephemeral identity; null when the session has none. */
export function signWithIdentity(address: string, payload: string): AuthChain | null {
  const identity = getIdentity(address)
  return identity ? Authenticator.signPayload(identity, payload) : null
}

const AUTH_TIMESTAMP_HEADER = 'x-identity-timestamp'
const AUTH_METADATA_HEADER = 'x-identity-metadata'

/**
 * ADR-44 signed-request headers: the auth chain signs `{method}:{path}:{timestamp}:{metadata}`
 * lowercased, and the timestamp/metadata travel as headers so the server can rebuild the payload.
 * `path` is the full URL pathname (API base included), without the query string.
 */
export function createAuthHeaders(
  address: string,
  method: string,
  path: string,
  metadata: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {}
  const identity = getIdentity(address)
  if (!identity) return headers
  const timestamp = String(Date.now())
  const metadataJson = JSON.stringify(metadata)
  const payload = `${method}:${path}:${timestamp}:${metadataJson}`.toLowerCase()
  const authChain = Authenticator.signPayload(identity, payload)
  for (let i = 0; i < authChain.length; i++) {
    headers[`${AUTH_CHAIN_HEADER_PREFIX}${i}`] = JSON.stringify(authChain[i])
  }
  headers[AUTH_TIMESTAMP_HEADER] = timestamp
  headers[AUTH_METADATA_HEADER] = metadataJson
  return headers
}

/**
 * The single signing chokepoint for server requests. `path` is relative to `baseUrl` and may carry
 * a query string; what gets signed is the resulting URL's pathname, which is what the servers verify.
 * `metadata` is signed along and sent as-is for servers that check the caller's `signer`/`intent`.
 */
export async function signedFetch(
  address: string | undefined,
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  metadata: Record<string, string> = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const url = `${baseUrl}${path}`
  const authHeaders = address ? createAuthHeaders(address, method, new URL(url).pathname, metadata) : {}
  return fetch(url, {
    ...init,
    method,
    // Caller headers win by design (e.g. Content-Type); no caller sets x-identity-* keys.
    headers: { ...authHeaders, ...init.headers }
  })
}
