// MANA (Polygon) balance and allowance reads plus the approve call a MANA payment may need first.
import { type ethers } from 'ethers'
import { ContractName, getContract } from 'decentraland-transactions'
import { readContract, type ContractCall } from '~/lib/auth'

export function getManaContract(chainId: number) {
  return getContract(ContractName.MANAToken, chainId)
}

export async function fetchManaBalance(address: string, chainId: number): Promise<bigint> {
  const balance = await readContract<ethers.BigNumber>(getManaContract(chainId), 'balanceOf', [address])
  return BigInt(balance.toString())
}

export async function fetchManaAllowance(owner: string, spender: string, chainId: number): Promise<bigint> {
  const allowance = await readContract<ethers.BigNumber>(getManaContract(chainId), 'allowance', [owner, spender])
  return BigInt(allowance.toString())
}

/** Headroom on a MANA approval for the oracle moving between the approval and the transaction (the legacy 0.5%). */
export const ORACLE_DRIFT_PAD_BPS = 50n

/** `amountWei` plus the oracle drift pad, rounded up so the pad never truncates to nothing. */
export function withOracleDriftPad(amountWei: bigint): bigint {
  return (amountWei * (10_000n + ORACLE_DRIFT_PAD_BPS) + 9_999n) / 10_000n
}

/**
 * ERC20 approve so `spender` can pull exactly `amountWei` (a fee, padded for oracle drift). Never unlimited: an
 * open-ended allowance would outlive the publish and expose the wallet's whole balance to the spender.
 */
export function buildManaApproveCall(chainId: number, spender: string, amountWei: bigint): ContractCall {
  if (amountWei <= 0n) throw new Error('MANA approval amount must be positive')
  return { contract: getManaContract(chainId), method: 'approve', args: [spender, amountWei.toString()] }
}
