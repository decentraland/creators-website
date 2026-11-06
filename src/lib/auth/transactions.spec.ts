import { describe, expect, it, vi } from 'vitest'
import { ethers } from 'ethers'
import { ContractName, getContract, getCouponManager, sendMetaTransaction } from 'decentraland-transactions'
import { type Session } from './auth'
import {
  WrongAccountError,
  WrongChainError,
  readWalletChainId,
  sendContractTransaction,
  sendWalletTransaction,
  signTypedData,
  subscribeWalletChain,
  switchWalletChain,
  watchTransaction
} from './transactions'
import { OFFCHAIN_MARKETPLACE_TYPES, getTradeDomain } from '~/lib/trades'
import { typedDataDigest } from '~/test/chain'

vi.mock('decentraland-transactions', async () => {
  const actual = await vi.importActual<typeof import('decentraland-transactions')>('decentraland-transactions')
  return { ...actual, sendMetaTransaction: vi.fn().mockResolvedValue('0xrelayed') }
})
vi.mock('decentraland-connect', () => ({ getRpcUrls: () => ({ 80002: 'https://rpc.example.com' }) }))

const manager = { ...getCouponManager(ContractName.OffChainMarketplaceV3, 80002), chainId: 80002 }
const call = { contract: manager, method: 'increaseSignerSignatureIndex', args: [] }

type Behavior = 'switches' | 'needs-add' | 'refuses' | 'ignores' | 'changes-account'

const ACCOUNT = '0x00000000000000000000000000000000000000aa'
const OTHER = '0x00000000000000000000000000000000000000bb'
const COLLECTION = '0x00000000000000000000000000000000000000ee'

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

describe('when the wallet is on another chain than the contract', () => {
  it('should relay the exact calldata as a Polygon meta-transaction', async () => {
    const eip1193 = { request: vi.fn() }
    const session = {
      web3Provider: { getNetwork: async () => ({ chainId: 1 }), provider: eip1193 }
    } as unknown as Session
    const contract = { ...getContract(ContractName.ERC721CollectionV2, 80002), address: COLLECTION }
    const transfer = { contract, method: 'transferCreatorship', args: [OTHER] }

    await expect(sendContractTransaction(session, transfer)).resolves.toBe('0xrelayed')
    const [provider, , data, target, options] = vi.mocked(sendMetaTransaction).mock.calls[0]
    expect(provider).toBe(eip1193)
    expect(target).toBe(contract)
    expect({ data, options }).toEqual({
      data: '0x6d2e4b1b00000000000000000000000000000000000000000000000000000000000000bb',
      options: { serverURL: 'https://transactions-api.decentraland.zone/v1' }
    })
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

describe('when watching a transaction until it settles', () => {
  const HASH = '0xpaid'
  const options = { timeoutMs: 10_000, pollMs: 1_000 }

  function chain(state: {
    receipt?: { status: number } | null
    tx?: { from: string; nonce: number } | null
    count?: number
    fail?: boolean
  }) {
    let time = 0
    const read = <T>(value: T) => (state.fail ? Promise.reject(new Error('rpc down')) : Promise.resolve(value))
    return {
      reader: {
        getTransactionReceipt: vi.fn(() => read(state.receipt ?? null)),
        getTransaction: vi.fn(() => read(state.tx ?? null)),
        getTransactionCount: vi.fn(() => read(state.count ?? 0))
      } as never,
      clock: {
        now: () => time,
        sleep: vi.fn(async (ms: number) => {
          time += ms
        })
      }
    }
  }

  it('should answer how a mined transaction ended', async () => {
    const { reader, clock } = chain({ receipt: { status: 1 } })
    await expect(watchTransaction(reader, HASH, { ...options, ...clock })).resolves.toBe('mined')
    const reverted = chain({ receipt: { status: 0 } })
    await expect(watchTransaction(reverted.reader, HASH, { ...options, ...reverted.clock })).resolves.toBe('reverted')
  })

  it('should answer dropped once another transaction used its nonce, as a wallet speed-up or cancel does', async () => {
    const { reader, clock } = chain({ tx: { from: ACCOUNT, nonce: 4 }, count: 5 })
    await expect(watchTransaction(reader, HASH, { ...options, ...clock })).resolves.toBe('dropped')
  })

  it('should answer dropped from the sender recorded at send time once the node forgot the transaction', async () => {
    const forgotten = chain({ count: 5 })
    await expect(
      watchTransaction(forgotten.reader, HASH, { ...options, ...forgotten.clock, sender: { from: ACCOUNT, nonce: 4 } })
    ).resolves.toBe('dropped')
  })

  it('should hand over the sender the first time the node returns the transaction', async () => {
    const { reader, clock } = chain({ tx: { from: ACCOUNT, nonce: 4 }, count: 4 })
    const onSeen = vi.fn()
    await watchTransaction(reader, HASH, { ...options, ...clock, onSeen })
    expect(onSeen).toHaveBeenCalledTimes(1)
    expect(onSeen).toHaveBeenCalledWith({ from: ACCOUNT, nonce: 4 })
  })

  it('should stop waiting at the timeout, as pending while the node still holds it', async () => {
    const { reader, clock } = chain({ tx: { from: ACCOUNT, nonce: 4 }, count: 4 })
    await expect(watchTransaction(reader, HASH, { ...options, ...clock })).resolves.toBe('pending')
    expect(clock.sleep).toHaveBeenCalledTimes(10)
  })

  it('should never call a transaction the node never saw dropped, nor one it could not read', async () => {
    const unknown = chain({})
    await expect(watchTransaction(unknown.reader, HASH, { ...options, ...unknown.clock })).resolves.toBe('pending')
    const down = chain({ fail: true })
    await expect(watchTransaction(down.reader, HASH, { ...options, ...down.clock })).resolves.toBe('pending')
  })
})

describe('signTypedData', () => {
  it('asks the wallet for an eth_signTypedData_v4 signature whose payload hashes to the order digest', async () => {
    const request = vi.fn(async ({ method }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_chainId') return '0x13882'
      if (method === 'eth_accounts') return [ACCOUNT]
      if (method === 'eth_signTypedData_v4') return '0xsignature'
      throw new Error(`Unexpected ${method}`)
    })
    const web3Provider = new ethers.providers.Web3Provider({ request }, 'any')
    const session = { address: ACCOUNT, web3Provider, signer: web3Provider.getSigner() } as unknown as Session
    const order = {
      checks: {
        uses: 90,
        expiration: 4102444800,
        effective: 1757500000,
        salt: '0x' + '00'.repeat(31) + '01',
        contractSignatureIndex: 2,
        signerSignatureIndex: 3,
        allowedRoot: '0x' + '00'.repeat(32),
        externalChecks: []
      },
      sent: [{ assetType: 4, contractAddress: '0x00000000000000000000000000000000000000cc', value: '7', extra: '0x' }],
      received: [
        {
          assetType: 2,
          contractAddress: getContract(ContractName.MANAToken, 80002).address,
          value: '500000000000000000',
          extra: '0x',
          beneficiary: ACCOUNT
        }
      ]
    }

    await expect(signTypedData(session, getTradeDomain(80002), OFFCHAIN_MARKETPLACE_TYPES, order)).resolves.toBe(
      '0xsignature'
    )

    const params = request.mock.calls.find(([args]) => args.method === 'eth_signTypedData_v4')?.[0].params
    const [signer, json] = params as [string, string]
    expect(signer).toBe(ACCOUNT)
    const payload = JSON.parse(json) as {
      primaryType: string
      domain: Record<string, string>
      types: Record<string, ethers.TypedDataField[]>
      message: Record<string, unknown>
    }
    expect(payload.primaryType).toBe('Trade')
    expect(payload.domain).toEqual({
      name: 'DecentralandMarketplacePolygon',
      version: '1.0.0',
      salt: '0x0000000000000000000000000000000000000000000000000000000000013882',
      verifyingContract: getContract(ContractName.OffChainMarketplaceV3, 80002).address
    })
    expect(payload.types.EIP712Domain).toEqual([
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' }
    ])
    const types = Object.fromEntries(Object.entries(payload.types).filter(([name]) => name !== 'EIP712Domain'))
    expect(typedDataDigest(payload.domain, types, payload.message)).toBe(
      '0xfc5244b13838fde268d232e2e06c9720b233590078a5dbd7c2ce17bebe156e9f'
    )
  })
})
