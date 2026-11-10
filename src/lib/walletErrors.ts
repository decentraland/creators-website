const WALLET_REJECTION_CODE = 4001
const WALLET_REJECTION_PATTERN = /user rejected|user denied|rejected the request/i
const MAX_CAUSES = 10

/**
 * The error and the causes under it, outermost first. Chain libraries wrap the wallet's own error (viem's
 * TransactionExecutionError over UserRejectedRequestError over the EIP-1193 object), so its code sits deeper.
 */
export function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  let current = error
  while (current !== undefined && current !== null && chain.length < MAX_CAUSES && !chain.includes(current)) {
    chain.push(current)
    current = typeof current === 'object' ? (current as { cause?: unknown }).cause : undefined
  }
  return chain
}

/** The creator dismissed the wallet prompt (EIP-1193 4001, ethers ACTION_REJECTED, or a wallet's own wording). */
export function isWalletRejection(error: unknown): boolean {
  return errorChain(error).some(link => {
    const message = link instanceof Error ? link.message : String(link)
    const code = (link as { code?: unknown }).code
    return code === WALLET_REJECTION_CODE || code === 'ACTION_REJECTED' || WALLET_REJECTION_PATTERN.test(message)
  })
}
