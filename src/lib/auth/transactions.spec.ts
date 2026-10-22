import { describe, expect, it, vi } from 'vitest'
import { ContractName, getCouponManager } from 'decentraland-transactions'
import { type Session } from './auth'
import {
  WrongAccountError,
  WrongChainError,
  readWalletChainId,
  sendContractTransaction,
  sendWalletTransaction,
  subscribeWalletChain,
  switchWalletChain
} from './transactions'

const manager = { ...getCouponManager(ContractName.OffChainMarketplaceV3, 80002), chainId: 80002 }
const call = { contract: manager, method: 'increaseSignerSignatureIndex', args: [] }

type Behavior = 'switches' | 'needs-add' | 'refuses' | 'ignores' | 'changes-account'

const ACCOUNT = '0x00000000000000000000000000000000000000aa'
const OTHER = '0x00000000000000000000000000000000000000bb'

/** A wallet on `chainId`, signed in as `account`, that reacts to a switch request the way `behavior` says. */
function walletOn(chainId: number, behavior: Behavior = 'switches', account = ACCOUNT) {
  let current = chainId
  let active = account
  const sendTransaction = vi.fn().mockResolvedValue({ hash: '0xhash', nonce: 7 })
  const send = vi.fn(async (method: string, params: { chainId: string }[]) => {
    if (method === 'eth_accounts') return [active]
    const target = Number(params[0].chainId)
    if (method === 'wallet_switchEthereumChain') {
      if (behavior === 'refuses') throw Object.assign(new Error('User rejected'), { code: 4001 })
      if (behavior === 'needs-add') throw Object.assign(new Error('Unrecognized chain'), { code: 4902 })
      // Magic answers the switch without moving the provider the session holds.
      if (behavior === 'ignores') return null
      if (behavior === 'changes-account') active = OTHER
    }
    current = target
    return null
  })
  const getSigner = vi.fn(() => ({ sendTransaction }))
  const provider = { getNetwork: vi.fn(async () => ({ chainId: current })), send, getSigner }
  return {
    session: { address: ACCOUNT, web3Provider: provider } as unknown as Session,
    provider,
    sendTransaction
  }
}

describe('when sending a transaction from the wallet itself', () => {
  it('should send it straight away when the wallet is already on the contract chain', async () => {
    const { session, provider, sendTransaction } = walletOn(80002)
    await expect(sendWalletTransaction(session, call)).resolves.toEqual({ hash: '0xhash', nonce: 7 })
    expect(provider.send).not.toHaveBeenCalledWith('wallet_switchEthereumChain', expect.anything())
    expect(sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ from: ACCOUNT, to: manager.address }))
    expect(provider.getSigner).toHaveBeenCalledWith(ACCOUNT)
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
    expect(provider.send).toHaveBeenCalledWith('wallet_addEthereumChain', [
      expect.objectContaining({ chainId: '0x13882', rpcUrls: ['https://rpc-amoy.polygon.technology'] })
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

  // A cancellation keyed by its caller mines fine from another account and ends nothing.
  it('should send nothing when the wallet has moved to another account', async () => {
    const { session, sendTransaction } = walletOn(80002, 'switches', OTHER)
    await expect(sendWalletTransaction(session, call)).rejects.toBeInstanceOf(WrongAccountError)
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  it('should send nothing when the account changes while switching chains', async () => {
    const { session, sendTransaction } = walletOn(1, 'changes-account')
    await expect(sendWalletTransaction(session, call)).rejects.toBeInstanceOf(WrongAccountError)
    expect(sendTransaction).not.toHaveBeenCalled()
  })

  // Amoy rejects tips under its floor, which wallets often propose.
  it("should floor the tip where the environment's network asks for it", async () => {
    const { session, sendTransaction } = walletOn(80002)
    await sendWalletTransaction(session, call)
    expect(sendTransaction.mock.calls[0][0].maxPriorityFeePerGas.toString()).toBe('30000000000')
  })

  it('should floor the tip on the regular path too, when the wallet is already on the contract chain', async () => {
    const { session, sendTransaction } = walletOn(80002)
    await sendContractTransaction({ ...session, signer: { sendTransaction } } as unknown as Session, call)
    expect(sendTransaction.mock.calls[0][0].maxPriorityFeePerGas.toString()).toBe('30000000000')
  })
})

describe('when the navbar asks where the wallet is', () => {
  const sessionAnswering = (answer: unknown) =>
    ({ web3Provider: { send: vi.fn(async () => answer) } }) as unknown as Session

  it('should read the live chain, however the wallet encodes it', async () => {
    await expect(readWalletChainId(sessionAnswering('0x13882'))).resolves.toBe(80002)
    await expect(readWalletChainId(sessionAnswering(137))).resolves.toBe(137)
    await expect(readWalletChainId(sessionAnswering('137'))).resolves.toBe(137)
  })

  it('should throw rather than guess on an unusable answer', async () => {
    await expect(readWalletChainId(sessionAnswering('not-a-chain'))).rejects.toThrow(/unusable/)
    await expect(readWalletChainId(sessionAnswering(null))).rejects.toThrow(/unusable/)
    await expect(readWalletChainId(sessionAnswering('0x0'))).rejects.toThrow(/unusable/)
  })

  it('should follow chain and account changes until unsubscribed', () => {
    const on = vi.fn()
    const removeListener = vi.fn()
    const session = { web3Provider: { provider: { on, removeListener } } } as unknown as Session
    const onChange = vi.fn()
    const unsubscribe = subscribeWalletChain(session, onChange)
    expect(on).toHaveBeenCalledWith('chainChanged', onChange)
    expect(on).toHaveBeenCalledWith('accountsChanged', onChange)
    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith('chainChanged', onChange)
    expect(removeListener).toHaveBeenCalledWith('accountsChanged', onChange)
  })

  it('should subscribe to nothing on a provider without events', () => {
    const session = { web3Provider: { provider: {} } } as unknown as Session
    expect(() => subscribeWalletChain(session, vi.fn())()).not.toThrow()
  })

  it('should let a refusal through when switching on request', async () => {
    const { session } = walletOn(1, 'refuses')
    await expect(switchWalletChain(session, 80002)).rejects.toMatchObject({ code: 4001 })
  })
})
