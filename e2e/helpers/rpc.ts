import { ethers } from 'ethers'

// Canned answers for the app's read-only JSON-RPC provider, so contract reads resolve without a chain.
const abi = ethers.utils.defaultAbiCoder
const selector = (signature: string) => ethers.utils.id(signature).slice(0, 10)

const MAX_UINT = ethers.constants.MaxUint256
const READS: Record<string, () => string> = {
  [selector('balanceOf(address)')]: () => abi.encode(['uint256'], [0]),
  [selector('allowance(address,address)')]: () => abi.encode(['uint256'], [MAX_UINT]),
  [selector('isApprovedForAll(address,address)')]: () => abi.encode(['bool'], [true]),
  [selector('decimals()')]: () => abi.encode(['uint8'], [8]),
  // ~0.27 USD per MANA at 8 decimals.
  [selector('latestRoundData()')]: () =>
    abi.encode(['uint80', 'int256', 'uint256', 'uint256', 'uint80'], [1, 26960836, 0, Math.floor(Date.now() / 1000), 1])
}

type RpcCall = { id?: number | string; method: string; params?: unknown[] }

function answer(call: RpcCall): unknown {
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
    case 'eth_getBlockByNumber':
      return { number: '0x1', timestamp: '0x0', baseFeePerGas: '0x1', hash: '0x' + '00'.repeat(32) }
    case 'eth_call': {
      const data = ((call.params?.[0] as { data?: string } | undefined)?.data ?? '0x').slice(0, 10)
      return READS[data]?.() ?? '0x'
    }
    default:
      return null
  }
}

/** Answers a JSON-RPC body, batched or single. */
export function handleRpc(body: string): unknown {
  const parsed = JSON.parse(body) as RpcCall | RpcCall[]
  const one = (call: RpcCall) => ({ jsonrpc: '2.0', id: call.id, result: answer(call) })
  return Array.isArray(parsed) ? parsed.map(one) : one(parsed)
}
