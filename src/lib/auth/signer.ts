// viem's wallet client and key code, loaded on demand: the overview's first load restores a session without them.
import {
  createWalletClient,
  custom,
  type Account,
  type Address,
  type CustomTransport,
  type Hex,
  type WalletClient
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Authenticator, type AuthIdentity } from '@dcl/crypto'
import { type Eip1193Provider } from './auth'

// Never retried: a wallet request may be a prompt, and a retry would show it again.
export function walletClientOf(
  provider: Eip1193Provider,
  address: string
): WalletClient<CustomTransport, undefined, Account> {
  return createWalletClient({ account: address as Address, transport: custom(provider, { retryCount: 0 }) })
}

/** The key pair the auth chain delegates to: a fresh random one unless `privateKey` is given. */
export function createEphemeralIdentity(privateKey?: Hex) {
  const key = privateKey ?? generatePrivateKey()
  const account = privateKeyToAccount(key)
  return { address: account.address, publicKey: account.publicKey, privateKey: key }
}

/** A new auth chain delegating to a fresh ephemeral key, which costs the wallet one signature. */
export async function createIdentity(
  provider: Eip1193Provider,
  address: string,
  expirationMinutes: number
): Promise<AuthIdentity> {
  const wallet = walletClientOf(provider, address)
  return Authenticator.initializeAuthChain(address, createEphemeralIdentity(), expirationMinutes, message =>
    wallet.signMessage({ message })
  )
}
