import { describe, expect, it, vi } from 'vitest'
import { ContractName, getCouponManager } from 'decentraland-transactions'
import { type Session } from './auth'
import { WrongChainError, sendWalletTransaction } from './transactions'

const manager = { ...getCouponManager(ContractName.OffChainMarketplaceV3, 80002), chainId: 80002 }
const call = { contract: manager, method: 'increaseSignerSignatureIndex', args: [] }

type Behavior = 'switches' | 'needs-add' | 'refuses' | 'ignores'

/** A wallet on `chainId` that reacts to a switch request the way `behavior` says. */
function walletOn(chainId: number, behavior: Behavior = 'switches') {
  let current = chainId
  const sendTransaction = vi.fn().mockResolvedValue({ hash: '0xhash' })
  const send = vi.fn(async (method: string, params: { chainId: string }[]) => {
    const target = Number(params[0].chainId)
    if (method === 'wallet_switchEthereumChain') {
      if (behavior === 'refuses') throw Object.assign(new Error('User rejected'), { code: 4001 })
      if (behavior === 'needs-add') throw Object.assign(new Error('Unrecognized chain'), { code: 4902 })
      // Magic answers the switch without moving the provider the session holds.
      if (behavior === 'ignores') return null
    }
    current = target
    return null
  })
  const provider = { getNetwork: vi.fn(async () => ({ chainId: current })), send }
  return {
    session: { web3Provider: provider, signer: { sendTransaction } } as unknown as Session,
    provider,
    sendTransaction
  }
}

describe('when sending a transaction from the wallet itself', () => {
  it('should send it straight away when the wallet is already on the contract chain', async () => {
    const { session, provider, sendTransaction } = walletOn(80002)
    await expect(sendWalletTransaction(session, call)).resolves.toBe('0xhash')
    expect(provider.send).not.toHaveBeenCalled()
    expect(sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ to: manager.address }))
  })

  it('should move the wallet to the contract chain first', async () => {
    const { session, provider, sendTransaction } = walletOn(1)
    await sendWalletTransaction(session, call)
    expect(provider.send).toHaveBeenCalledWith('wallet_switchEthereumChain', [{ chainId: '0x13882' }])
    expect(sendTransaction).toHaveBeenCalled()
  })

  it('should add the chain when the wallet does not know it yet', async () => {
    const { session, provider, sendTransaction } = walletOn(1, 'needs-add')
    await sendWalletTransaction(session, call)
    expect(provider.send).toHaveBeenLastCalledWith('wallet_addEthereumChain', [
      expect.objectContaining({ chainId: '0x13882' })
    ])
    expect(sendTransaction).toHaveBeenCalled()
  })

  it('should send nothing when the creator refuses the switch', async () => {
    const { session, sendTransaction } = walletOn(1, 'refuses')
    await expect(sendWalletTransaction(session, call)).rejects.toMatchObject({ code: 4001 })
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  it('should send nothing when the wallet answers the switch but stays where it was', async () => {
    const { session, sendTransaction } = walletOn(1, 'ignores')
    await expect(sendWalletTransaction(session, call)).rejects.toBeInstanceOf(WrongChainError)
    expect(sendTransaction).not.toHaveBeenCalled()
  })
})
