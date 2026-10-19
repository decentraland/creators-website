import { describe, expect, it, vi } from 'vitest'
import { ContractName, getCouponManager } from 'decentraland-transactions'

// The production networks set no tip floor: the wallet's own fee estimate goes through untouched.
vi.mock('~/config', async () => {
  const actual = await vi.importActual<typeof import('~/config')>('~/config')
  return {
    ...actual,
    config: { get: (key: string) => (key === 'MATIC_MIN_TIP_GWEI' ? '' : actual.config.get(key)) }
  }
})

import { type Session } from './auth'
import { sendWalletTransaction } from './transactions'

describe('when the environment sets no tip floor', () => {
  it('should leave the fees to the wallet', async () => {
    const sendTransaction = vi.fn().mockResolvedValue({ hash: '0xhash', nonce: 1 })
    const session = {
      address: '0x00000000000000000000000000000000000000aa',
      web3Provider: {
        getNetwork: async () => ({ chainId: 80002 }),
        send: async () => ['0x00000000000000000000000000000000000000aa'],
        getSigner: () => ({ sendTransaction })
      }
    } as unknown as Session
    const manager = { ...getCouponManager(ContractName.OffChainMarketplaceV3, 80002), chainId: 80002 }

    await sendWalletTransaction(session, { contract: manager, method: 'increaseSignerSignatureIndex', args: [] })

    expect(sendTransaction.mock.calls[0][0]).not.toHaveProperty('maxPriorityFeePerGas')
  })
})
