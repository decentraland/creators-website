// For specs that pin chain outputs (calldata, EIP-712 digests, signatures) as literals.
import { ethers } from 'ethers'
import { encodeContractCall, type ContractCall } from '~/lib/auth/transactions'

/** A throwaway key, so pinned signatures come out the same on every run. */
export const TEST_PRIVATE_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111'
export const TEST_SIGNER = '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A'

const testWallet = new ethers.Wallet(TEST_PRIVATE_KEY)

/** The target and calldata the call puts on chain. */
export function toTransaction(call: ContractCall): { to: string; data: string } {
  return { to: call.contract.address, data: encodeContractCall(call) }
}

export function typedDataDigest(
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): string {
  return ethers.utils._TypedDataEncoder.hash(domain, types, value)
}

export function signTypedDataWithTestKey(
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): Promise<string> {
  return testWallet._signTypedData(domain, types, value)
}
