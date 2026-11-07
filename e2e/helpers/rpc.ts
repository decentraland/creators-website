import { ethers } from 'ethers'
import { RARITIES } from '../fixtures'
import { TEST_PRIVATE_KEY } from './session'

// One fake chain per run, behind both the app's read node and the mock wallet: a transaction the wallet sends
// is the one the read node returns a receipt for.

const abi = ethers.utils.defaultAbiCoder
const selector = (signature: string) => ethers.utils.id(signature).slice(0, 10)

/** Functions the app sends, decoded in `app.transactions` and by the fake builder-server. */
export const CONTRACT_FUNCTIONS = new ethers.utils.Interface([
  'function approve(address spender, uint256 amount)',
  'function createCollection(address forwarder, address factory, bytes32 salt, string name, string symbol, string baseURI, address creator, (string rarity, uint256 price, address beneficiary, string metadata)[] items)',
  'function setMinters(address[] minters, bool[] values)',
  'function setManagers(address[] managers, bool[] values)',
  'function issueTokens(address[] beneficiaries, uint256[] itemIds)',
  'function transferCreatorship(address creator)',
  'function editItemsData(uint256[] itemIds, uint256[] prices, address[] beneficiaries, string[] metadata)',
  'function manageCollection(address manager, address forwarder, address collection, bytes[] data)',
  'function setApproved(bool value)',
  'function rescueItems(uint256[] itemIds, string[] contentHashes, string[] metadata)'
])

/** Selectors the app sends whose arguments no spec reads yet: named only. */
const NAMED_SELECTORS: Record<string, string> = {
  '0x1863572d': 'useCredits',
  '0x6f773280': 'cancelSignature',
  '0xd41feedf': 'cancelSignature',
  '0x3cb681b0': 'reviewThirdPartyWithRoot',
  '0xdb9aa95c': 'addThirdParties',
  '0xd8f0f3c1': 'buyItemSlots'
}

export type SentTransaction = {
  hash: string
  from: string
  to: string
  data: string
  /** The function name, when the selector is known. */
  fn?: string
  /** Decoded arguments, when the function is in CONTRACT_FUNCTIONS. */
  args?: ethers.utils.Result
}

export type ChainOptions = {
  /** MANA balance (wei) of every account. Default 0. */
  manaBalanceWei?: string
  /** MANA allowance (wei) every spender has. Default unlimited, so no approve is needed. */
  manaAllowanceWei?: string
}

export const MANA_USD_AGGREGATOR = '0x' + 'ae'.repeat(20)
// ~0.27 USD per MANA at 8 decimals.
const MANA_USD_RATE = 26960836

type RpcCall = { id?: number | string; method: string; params?: unknown[] }

export function decodeTransaction(tx: Omit<SentTransaction, 'fn' | 'args'>): SentTransaction {
  const data = tx.data ?? '0x'
  try {
    const parsed = CONTRACT_FUNCTIONS.parseTransaction({ data })
    return { ...tx, fn: parsed.name, args: parsed.args }
  } catch {
    return { ...tx, fn: NAMED_SELECTORS[data.slice(0, 10)] }
  }
}

export function createChain(opts: ChainOptions = {}, signer = new ethers.Wallet(TEST_PRIVATE_KEY)) {
  const transactions: SentTransaction[] = []
  const listeners: Array<(tx: SentTransaction) => void> = []

  const reads: Record<string, (data: string, to: string) => string> = {
    [selector('balanceOf(address)')]: () => abi.encode(['uint256'], [opts.manaBalanceWei ?? 0]),
    [selector('allowance(address,address)')]: () =>
      abi.encode(['uint256'], [opts.manaAllowanceWei ?? ethers.constants.MaxUint256]),
    [selector('isApprovedForAll(address,address)')]: () => abi.encode(['bool'], [true]),
    [selector('decimals()')]: (_, to) => abi.encode(['uint8'], [to.toLowerCase() === MANA_USD_AGGREGATOR ? 8 : 18]),
    [selector('manaUsdAggregator()')]: () => abi.encode(['address'], [MANA_USD_AGGREGATOR]),
    [selector('latestRoundData()')]: () => {
      const now = Math.floor(Date.now() / 1000)
      return abi.encode(['uint80', 'int256', 'uint256', 'uint256', 'uint80'], [1, MANA_USD_RATE, now, now, 1])
    },
    [selector('getRarityByName(string)')]: data => {
      const [name] = abi.decode(['string'], '0x' + data.slice(10)) as unknown as [string]
      const rarity = RARITIES.find(r => r.name === name) ?? RARITIES[0]
      return abi.encode(['tuple(string,uint256,uint256)'], [[rarity.name, rarity.maxSupply, rarity.prices.MANA]])
    },
    [selector('contractSignatureIndex()')]: () => abi.encode(['uint256'], [0]),
    [selector('signerSignatureIndex(address)')]: () => abi.encode(['uint256'], [0])
  }

  const transactionResult = (hash: string) => {
    const tx = transactions.find(t => t.hash === hash)
    return {
      hash,
      from: tx?.from ?? signer.address.toLowerCase(),
      to: tx?.to ?? null,
      input: tx?.data ?? '0x',
      blockNumber: '0x1',
      blockHash: '0x' + '00'.repeat(32),
      transactionIndex: '0x0',
      nonce: '0x0',
      value: '0x0',
      gas: '0x5208',
      gasPrice: '0x1',
      chainId: '0x13882',
      type: '0x0',
      v: '0x1b',
      r: '0x' + '01'.repeat(32),
      s: '0x' + '01'.repeat(32)
    }
  }

  // Every hash settles: a block at height 1 with the current head at 1 is one confirmation.
  const receipt = (hash: string) => {
    const tx = transactions.find(t => t.hash === hash)
    return {
      status: '0x1',
      transactionHash: hash,
      transactionIndex: '0x0',
      blockNumber: '0x1',
      blockHash: '0x' + '00'.repeat(32),
      from: tx?.from ?? signer.address.toLowerCase(),
      to: tx?.to ?? null,
      contractAddress: null,
      gasUsed: '0x5208',
      cumulativeGasUsed: '0x5208',
      effectiveGasPrice: '0x1',
      logs: [],
      logsBloom: '0x' + '00'.repeat(256),
      type: '0x2'
    }
  }

  function answer(call: RpcCall): unknown {
    const params = call.params ?? []
    switch (call.method) {
      case 'eth_chainId':
        return '0x13882'
      case 'net_version':
        return '80002'
      case 'eth_blockNumber':
        return '0x1'
      case 'eth_gasPrice':
      case 'eth_maxPriorityFeePerGas':
        return '0x3b9aca00'
      case 'eth_estimateGas':
        return '0x5208'
      case 'eth_getCode':
        return '0x'
      case 'eth_getTransactionCount':
        return '0x0'
      case 'eth_getBlockByNumber':
        return { number: '0x1', timestamp: '0x0', baseFeePerGas: '0x1', hash: '0x' + '00'.repeat(32) }
      case 'eth_getTransactionReceipt':
        return receipt(params[0] as string)
      case 'eth_getTransactionByHash':
        return transactionResult(params[0] as string)
      case 'eth_call': {
        const { data = '0x', to = '' } = (params[0] ?? {}) as { data?: string; to?: string }
        return reads[data.slice(0, 10)]?.(data, to) ?? '0x'
      }
      default:
        return null
    }
  }

  /** The read node's JSON-RPC endpoint, batched or single. */
  function handleRpc(body: string): unknown {
    const parsed = JSON.parse(body) as RpcCall | RpcCall[]
    const one = (call: RpcCall) => ({ jsonrpc: '2.0', id: call.id, result: answer(call) })
    return Array.isArray(parsed) ? parsed.map(one) : one(parsed)
  }

  /** The mock wallet's EIP-1193 `request`, run in node so signatures are real and transactions are logged. */
  async function walletRequest(method: string, params: unknown[] = []): Promise<unknown> {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [signer.address.toLowerCase()]
      case 'eth_sendTransaction': {
        const { from = signer.address, to = '', data = '0x' } = (params[0] ?? {}) as Partial<SentTransaction>
        const hash = ethers.utils.id(`e2e-tx-${transactions.length}-${data}`)
        const tx = decodeTransaction({ hash, from: from.toLowerCase(), to: to.toLowerCase(), data })
        transactions.push(tx)
        for (const listener of listeners) listener(tx)
        return hash
      }
      case 'personal_sign': {
        const message = params[0] as string
        return signer.signMessage(ethers.utils.isHexString(message) ? ethers.utils.arrayify(message) : message)
      }
      case 'eth_sign':
        return signer.signMessage(ethers.utils.arrayify(params[1] as string))
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4': {
        const typed = (typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]) as {
          domain: ethers.TypedDataDomain
          types: Record<string, ethers.TypedDataField[]>
          message: Record<string, unknown>
        }
        // ethers derives the domain type itself and refuses one in `types`.
        const types = Object.fromEntries(Object.entries(typed.types).filter(([name]) => name !== 'EIP712Domain'))
        return signer._signTypedData(typed.domain, types, typed.message)
      }
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain':
        return null
      default:
        return answer({ method, params })
    }
  }

  return {
    handleRpc,
    walletRequest,
    transactions,
    onTransaction: (listener: (tx: SentTransaction) => void) => listeners.push(listener)
  }
}

export type Chain = ReturnType<typeof createChain>
