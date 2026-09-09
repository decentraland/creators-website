// MANA (Polygon) balance and allowance reads plus the approve call a MANA payment may need first.
import { ethers } from 'ethers'
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

/** ERC20 approve so `spender` can pull the publication fee. Unlimited by default, like the legacy builder. */
export function buildManaApproveCall(
  chainId: number,
  spender: string,
  amount: bigint = BigInt(ethers.constants.MaxUint256.toString())
): ContractCall {
  return { contract: getManaContract(chainId), method: 'approve', args: [spender, amount.toString()] }
}
