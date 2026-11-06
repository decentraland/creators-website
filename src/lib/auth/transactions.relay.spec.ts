import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPublicClient, http, parseAbi, type PublicClient } from 'viem'
import * as pkg from 'decentraland-transactions'
import { getCollectionContract, getContract, type ContractData } from '~/lib/chain/contracts'
import { TEST_SIGNER, testAccount } from '~/test/chain'
import { type Session } from './auth'
import { sendContractTransaction } from './transactions'

vi.mock('decentraland-connect', () => ({ getRpcUrls: () => ({ 80002: 'https://rpc.example.com' }) }))

afterEach(() => {
  vi.unstubAllGlobals()
})

const RPC = 'https://rpc.example.com'
const SERVER = 'https://transactions-api.decentraland.zone/v1'
const COLLECTION = '0x00000000000000000000000000000000000000ee'
const HASH = `0x${'ab'.repeat(32)}`
const NONCE = `0x${'0'.repeat(62)}2a`

type Request = { method: string; params?: unknown[] }
type Scenario = {
  code?: string
  ledger?: boolean
  denies?: boolean
  noRequestAccounts?: boolean
  relay?: { status: number; body: object }
}

/** A wallet signing with the test key, a read node answering the nonce, and the relayer; all logged. */
function world(scenario: Scenario = {}) {
  const walletLog: Request[] = []
  const request = async ({ method, params = [] }: Request): Promise<unknown> => {
    walletLog.push({ method, params })
    switch (method) {
      case 'eth_chainId':
        return '0x1'
      case 'eth_requestAccounts':
        if (scenario.noRequestAccounts) throw new Error('Unsupported method')
        return [TEST_SIGNER]
      case 'eth_accounts':
        return [TEST_SIGNER]
      case 'eth_getCode':
        return scenario.code ?? '0x'
      case 'eth_signTypedData_v4': {
        if (scenario.denies) throw new Error('MetaMask Typed Message Signature: User denied message signature.')
        const { types, domain, primaryType, message } = JSON.parse(params[1] as string)
        const withoutDomain = Object.fromEntries(Object.entries(types).filter(([name]) => name !== 'EIP712Domain'))
        const signature = await testAccount.signTypedData({ types: withoutDomain, domain, primaryType, message })
        if (!scenario.ledger) return signature
        return signature.slice(0, -2) + (parseInt(signature.slice(-2), 16) - 27).toString(16).padStart(2, '0')
      }
    }
    throw new Error(`Unexpected ${method}`)
  }
  const relayLog: { url: string; init: RequestInit }[] = []
  const nodeLog: Request[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith(SERVER)) {
        relayLog.push({ url, init })
        const { status, body } = scenario.relay ?? { status: 200, body: { ok: true, txHash: HASH } }
        return new Response(JSON.stringify(body), { status })
      }
      const body = JSON.parse(init.body as string) as { id: number; method: string; params: unknown[] }
      nodeLog.push({ method: body.method, params: body.params })
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: NONCE }))
    })
  )
  const session = { address: TEST_SIGNER, provider: { request } } as unknown as Session
  // eth_chainId is how lib/auth picks the meta-transaction path; the package is handed that decision.
  const logs = () => ({
    wallet: walletLog.filter(({ method }) => method !== 'eth_chainId'),
    node: nodeLog,
    relay: relayLog
  })
  return { session, request, logs }
}

async function outcome(run: () => Promise<string>) {
  try {
    return { hash: await run() }
  } catch (error) {
    const { message, code } = error as { message: string; code: string }
    return { error: { message, code } }
  }
}

const reader: PublicClient = createPublicClient({ transport: http(RPC) })
const metaTransactionProvider = {
  request: ({ method, params }: Request) => reader.request({ method, params } as Parameters<PublicClient['request']>[0])
}

type Case = readonly [ours: ContractData, theirs: pkg.ContractData, method: string, args: readonly unknown[]]

async function compare([ours, theirs, method, args]: Case, scenario?: Scenario) {
  const call = { contract: ours, method, args: [...args] }
  const port = world(scenario)
  const portResult = await outcome(() => sendContractTransaction(port.session, call))
  const original = world(scenario)
  const { encodeContractCall } = await import('./transactions')
  const originalResult = await outcome(() =>
    pkg.sendMetaTransaction({ request: original.request }, metaTransactionProvider, encodeContractCall(call), theirs, {
      serverURL: SERVER
    })
  )
  expect(portResult).toEqual(originalResult)
  expect(port.logs()).toEqual(original.logs())
  return port.logs()
}

const collectionCall = [
  getCollectionContract(80002, COLLECTION),
  { ...pkg.getContract(pkg.ContractName.ERC721CollectionV2, 80002), address: COLLECTION },
  'transferCreatorship',
  ['0x00000000000000000000000000000000000000bb']
] as const satisfies Case

// increaseSignerSignatureIndex() keeps the calldata short; the meta-transaction style comes from the deployment.
const marketplaceCall = [
  { ...getContract('OffChainMarketplaceV3', 80002), abi: parseAbi(['function increaseSignerSignatureIndex()']) },
  pkg.getContract(pkg.ContractName.OffChainMarketplaceV3, 80002),
  'increaseSignerSignatureIndex',
  []
] as const satisfies Case

describe('the ported meta-transaction, against decentraland-transactions', () => {
  it.each([
    ['functionSignature', collectionCall],
    ['functionData', marketplaceCall]
  ] as const)('should ask the wallet, the node and the relayer the same in the %s style', async (_, args) => {
    const logs = await compare(args)
    expect(logs.relay).toHaveLength(1)
    expect(logs.wallet.map(({ method }) => method)).toEqual([
      'eth_requestAccounts',
      'eth_getCode',
      'eth_signTypedData_v4'
    ])
  })

  it.each([
    ['functionSignature', collectionCall],
    ['functionData', marketplaceCall]
  ] as const)("should normalize a Ledger's recovery id the same in the %s style", async (_, args) => {
    await compare(args, { ledger: true })
  })

  it.each<[string, Scenario]>([
    ['the wallet only answers eth_accounts', { noRequestAccounts: true }],
    ['the signer is an EIP-7702 delegated account', { code: `0xef0100${'cd'.repeat(20)}` }],
    ['the signer is a contract', { code: '0x6080604052' }],
    ['the creator denies the signature', { denies: true }],
    [
      'the relayer refuses with a reason',
      { relay: { status: 400, body: { ok: false, message: 'Max limit', code: 'user_limit_reached' } } }
    ],
    ['the relayer refuses without one', { relay: { status: 500, body: { ok: false } } }]
  ])('should end the same when %s', async (_, scenario) => {
    await compare(collectionCall, scenario)
  })

  it('should read the nonce from the contract chain the same way', async () => {
    const logs = await compare(collectionCall)
    expect(logs.node).toEqual([
      {
        method: 'eth_call',
        params: [{ data: `0x2d0335ab${TEST_SIGNER.slice(2).padStart(64, '0')}`, to: COLLECTION }, 'latest']
      }
    ])
  })
})
