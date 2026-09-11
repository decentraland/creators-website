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
    const tx = await session.signer.sendTransaction({ to: call.contract.address, data })
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

/** EIP-712 signature of `value` by the connected wallet (an off-chain order, not a transaction). */
export async function signTypedData(
  session: Session,
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): Promise<string> {
  return session.signer._signTypedData(domain, types, value)
}

/** Resolves true when the transaction is mined successfully, false when it reverted. */
export async function waitForTransaction(chainId: number, txHash: string, timeoutMs?: number): Promise<boolean> {
  const provider = await getReadProvider(chainId)
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs)
  return receipt.status === 1
}
