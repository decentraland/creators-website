const WALLET_REJECTION_CODE = 4001
const WALLET_REJECTION_PATTERN = /user rejected|user denied|rejected the request/i

/** The creator dismissed the wallet prompt (EIP-1193 4001, ethers ACTION_REJECTED, or a wallet's own wording). */
export function isWalletRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: unknown } | null)?.code
  return code === WALLET_REJECTION_CODE || code === 'ACTION_REJECTED' || WALLET_REJECTION_PATTERN.test(message)
}
