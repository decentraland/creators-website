// On-chain reads and writes, kept inside the sealed auth module (CONVENTIONS.md, seam 1) so the
// provider never leaks: consumers describe a call (contract + method + args) and get a tx hash back.
// Writes go straight through the wallet when it already sits on the target chain, and otherwise as
// a Polygon meta-transaction through Decentraland's relayer — the same path the legacy builder uses.
import { ethers } from 'ethers'
import { ProviderType } from '@dcl/schemas'
import { sendMetaTransaction, type ContractData } from 'decentraland-transactions'
import { config } from '~/config'
import { type Session } from './auth'

export type { ContractData }

export type ContractCall = {
  contract: ContractData
  method: string
  args: unknown[]
}

const readProviders = new Map<number, ethers.providers.JsonRpcProvider>()

async function getReadProvider(chainId: number): Promise<ethers.providers.JsonRpcProvider> {
  const cached = readProviders.get(chainId)
  if (cached) return cached
  const { getRpcUrls } = await import('decentraland-connect')
  const url = getRpcUrls(ProviderType.INJECTED)[chainId]
  if (!url) throw new Error(`No RPC url configured for chain ${chainId}`)
  const provider = new ethers.providers.StaticJsonRpcProvider(url, chainId)
  readProviders.set(chainId, provider)
  return provider
}

/** ABI-encoded calldata for a contract call. */
export function encodeContractCall({ contract, method, args }: ContractCall): string {
  return new ethers.utils.Interface(contract.abi).encodeFunctionData(method, args)
}

export async function readContract<T>(contract: ContractData, method: string, args: unknown[] = []): Promise<T> {
  const provider = await getReadProvider(contract.chainId)
  const instance = new ethers.Contract(contract.address, contract.abi, provider)
  const fn = instance[method] as (...callArgs: unknown[]) => Promise<T>
  return fn(...args)
}

/** Sends the call and resolves with the transaction hash (not the receipt). */
export async function sendContractTransaction(session: Session, call: ContractCall): Promise<string> {
  const data = encodeContractCall(call)
  const network = await session.web3Provider.getNetwork()
  if (network.chainId === Number(call.contract.chainId)) {
    const tx = await session.signer.sendTransaction({
      to: call.contract.address,
      data,
      ...gasOverrides(network.chainId)
    })
    return tx.hash
  }
  const targetProvider = await getReadProvider(call.contract.chainId)
  return sendMetaTransaction(
    session.web3Provider.provider as Parameters<typeof sendMetaTransaction>[0],
    targetProvider,
    data,
    call.contract,
    { serverURL: config.get('TRANSACTIONS_API_URL') }
  )
}

// Wallets that don't know the chain yet (EIP-3085) answer a switch with 4902 and need it added first. Only this
// environment's Polygon is ever added; its details live in the env config.
function addChainParams(chainId: number): object | undefined {
  if (chainId !== Number(config.get('MATIC_CHAIN_ID'))) return undefined
  return {
    chainId: ethers.utils.hexValue(chainId),
    chainName: config.get('MATIC_CHAIN_NAME'),
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: [config.get('MATIC_RPC_URL')],
    blockExplorerUrls: [config.get('MATIC_EXPLORER_URL')]
  }
}

// MetaMask mobile wraps the 4902 in an internal error.
function isUnknownChain(error: unknown): boolean {
  const { code, data } = (error ?? {}) as { code?: number; data?: { originalError?: { code?: number } } }
  return code === 4902 || data?.originalError?.code === 4902
}

/**
 * Asks the wallet to move to `chainId`, adding this environment's Polygon first when the wallet doesn't know it.
 * Call it from a click: wallets refuse `wallet_*` requests they can't attribute to a user action. A refusal
 * (code 4001) propagates: the user answered, nothing moved.
 */
export async function switchWalletChain(session: Session, chainId: number): Promise<void> {
  try {
    await session.web3Provider.send('wallet_switchEthereumChain', [{ chainId: ethers.utils.hexValue(chainId) }])
  } catch (error) {
    const add = addChainParams(chainId)
    if (!isUnknownChain(error) || !add) throw error
    await session.web3Provider.send('wallet_addEthereumChain', [add])
  }
}

/**
 * The chain the wallet is on right now. Asked over `eth_chainId` rather than ethers' `getNetwork()`, which
 * answers from the network it first detected.
 */
export async function readWalletChainId(session: Session): Promise<number> {
  const raw = (await session.web3Provider.send('eth_chainId', [])) as string | number
  const parsed = typeof raw === 'string' ? parseInt(raw, 16) : Number(raw)
  if (!Number.isFinite(parsed)) throw new Error(`Wallet answered eth_chainId with an unusable value: ${String(raw)}`)
  return parsed
}

type Eip1193Events = {
  on?: (event: string, cb: (...args: unknown[]) => void) => void
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void
}

/**
 * Runs `onChange` whenever the wallet announces a chain change, and on an account change too, since another
 * account can sit on another chain without the wallet re-announcing it. Returns the unsubscribe; a provider
 * without events (Magic) subscribes to nothing.
 */
export function subscribeWalletChain(session: Session, onChange: () => void): () => void {
  const wallet = session.web3Provider.provider as Eip1193Events | undefined
  if (!wallet?.on || !wallet.removeListener) return () => undefined
  wallet.on('chainChanged', onChange)
  wallet.on('accountsChanged', onChange)
  return () => {
    wallet.removeListener?.('chainChanged', onChange)
    wallet.removeListener?.('accountsChanged', onChange)
  }
}

/** The wallet is still on another chain after being asked to switch: nothing was sent. */
export class WrongChainError extends Error {
  constructor(
    public expected: number,
    public actual: number
  ) {
    super(`The wallet is on chain ${actual}, not ${expected}`)
    this.name = 'WrongChainError'
  }
}

/** The wallet's active account is not the session's: sending would act as somebody else. Nothing was sent. */
export class WrongAccountError extends Error {
  constructor(
    public expected: string,
    public actual: string
  ) {
    super(`The wallet's active account is ${actual}, not ${expected}`)
    this.name = 'WrongAccountError'
  }
}

/** Throws `WrongAccountError` unless the wallet's active account is the session's. */
export async function requireAccount(session: Session): Promise<void> {
  const accounts = (await session.web3Provider.send('eth_accounts', [])) as string[]
  const active = (accounts[0] ?? '').toLowerCase()
  if (active !== session.address.toLowerCase()) throw new WrongAccountError(session.address, active)
}

// Some networks (Amoy) enforce a minimum tip above what wallets propose, so the RPC rejects the transaction. The
// floor, when there is one, comes from the env config.
function gasOverrides(chainId: number): ethers.providers.TransactionRequest {
  const minTip = config.get('MATIC_MIN_TIP_GWEI')
  if (!minTip || chainId !== Number(config.get('MATIC_CHAIN_ID'))) return {}
  const tip = ethers.utils.parseUnits(minTip, 'gwei')
  return { maxPriorityFeePerGas: tip, maxFeePerGas: tip.add(ethers.utils.parseUnits('50', 'gwei')) }
}

/**
 * Sends the call from the wallet itself, moving it to the contract's chain first, for contracts that take no
 * meta-transactions: the wallet pays the gas. Call it from a click, since wallets refuse unprompted chain switches.
 * The network is read again after the switch: some providers (Magic) answer it without moving the wallet. It is
 * sent from the session's account only: a call keyed by its caller, like a cancellation, does nothing from another.
 */
export async function sendWalletTransaction(
  session: Session,
  call: ContractCall
): Promise<{ hash: string; nonce: number }> {
  const chainId = Number(call.contract.chainId)
  await requireAccount(session)
  if ((await session.web3Provider.getNetwork()).chainId !== chainId) {
    await switchWalletChain(session, chainId)
    const current = (await session.web3Provider.getNetwork()).chainId
    if (current !== chainId) throw new WrongChainError(chainId, current)
    // Switching hands control to the wallet, where the account can change too.
    await requireAccount(session)
  }
  // Bound to the session's address, so the wallet refuses to send it from any other account.
  const tx = await session.web3Provider.getSigner(session.address).sendTransaction({
    from: session.address,
    to: call.contract.address,
    data: encodeContractCall(call),
    ...gasOverrides(chainId)
  })
  return { hash: tx.hash, nonce: tx.nonce }
}

/** EIP-712 signature of `value` by the connected wallet (an off-chain order, not a transaction). */
export async function signTypedData(
  session: Session,
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): Promise<string> {
  return session.signer._signTypedData(domain, types, value)
}

/**
 * What the chain says about a transaction now: `mined` or `reverted` once it has a receipt; `superseded` when it has
 * none but its sender has already used its nonce, so it can never execute; `unknown` otherwise (still pending, or
 * the read failed).
 */
export async function readTransactionOutcome(
  chainId: number,
  txHash: string,
  from: string,
  nonce?: number
): Promise<'mined' | 'reverted' | 'superseded' | 'unknown'> {
  try {
    const provider = await getReadProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (receipt) return receipt.status === 1 ? 'mined' : 'reverted'
    const known = nonce ?? (await provider.getTransaction(txHash))?.nonce
    if (known === undefined) return 'unknown'
    return (await provider.getTransactionCount(from, 'latest')) > known ? 'superseded' : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Resolves true when the transaction is mined successfully, false when it reverted. */
export async function waitForTransaction(chainId: number, txHash: string, timeoutMs?: number): Promise<boolean> {
  const provider = await getReadProvider(chainId)
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs)
  return receipt.status === 1
}
