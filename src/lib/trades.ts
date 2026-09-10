// Off-chain marketplace (OffChainMarketplaceV2) orders: the EIP-712 encoding a creator signs and the
// marketplace-server endpoint that stores the signed order. Ported from the legacy builder's
// lib/trades + TradeService; the shop reads these orders back through its unified catalog.
import { ethers } from 'ethers'
import { TradeAssetType, type OnChainTrade, type Trade, type TradeAsset, type TradeCreation } from '@dcl/schemas'
import { ContractName, getContract, getContractName } from 'decentraland-transactions'
import { config } from '~/config'
import { readContract, signedFetch } from '~/lib/auth'

export type UnsignedTrade = Omit<TradeCreation, 'signature'>

export const OFFCHAIN_MARKETPLACE_TYPES: Record<string, ethers.TypedDataField[]> = {
  Trade: [
    { name: 'checks', type: 'Checks' },
    { name: 'sent', type: 'AssetWithoutBeneficiary[]' },
    { name: 'received', type: 'Asset[]' }
  ],
  Asset: [
    { name: 'assetType', type: 'uint256' },
    { name: 'contractAddress', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'extra', type: 'bytes' },
    { name: 'beneficiary', type: 'address' }
  ],
  AssetWithoutBeneficiary: [
    { name: 'assetType', type: 'uint256' },
    { name: 'contractAddress', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'extra', type: 'bytes' }
  ],
  Checks: [
    { name: 'uses', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'effective', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
    { name: 'contractSignatureIndex', type: 'uint256' },
    { name: 'signerSignatureIndex', type: 'uint256' },
    { name: 'allowedRoot', type: 'bytes32' },
    { name: 'externalChecks', type: 'ExternalCheck[]' }
  ],
  ExternalCheck: [
    { name: 'contractAddress', type: 'address' },
    { name: 'selector', type: 'bytes4' },
    { name: 'value', type: 'bytes' },
    { name: 'required', type: 'bool' }
  ]
}

// Signed requests to marketplace-server must declare who signs and why.
const TRADE_AUTH_METADATA = { signer: 'dcl:builder', intent: 'dcl:create-trade' }

export function getOffchainMarketplaceContract(chainId: number) {
  return getContract(ContractName.OffChainMarketplaceV2, chainId)
}

/** The marketplace's EIP-712 domain: the chain id travels in `salt`, Decentraland's meta-tx convention. */
export function getTradeDomain(chainId: number): ethers.TypedDataDomain {
  const contract = getOffchainMarketplaceContract(chainId)
  return {
    name: contract.name,
    version: contract.version,
    salt: ethers.utils.hexZeroPad(ethers.utils.hexlify(chainId), 32),
    verifyingContract: contract.address
  }
}

function assetValue(asset: TradeAsset): string {
  switch (asset.assetType) {
    case TradeAssetType.ERC721:
      return asset.tokenId
    case TradeAssetType.COLLECTION_ITEM:
      return asset.itemId
    case TradeAssetType.ERC20:
    case TradeAssetType.USD_PEGGED_MANA:
      return asset.amount
  }
}

const toSeconds = (ms: number) => Math.floor(ms / 1000)
// Empty bytes are encoded as '0x'; the server-side JSON keeps ''.
const bytes = (value: string) => value || '0x'

/** The struct the wallet signs: timestamps in seconds, bytes32 fields zero-padded, assets flattened to `value`. */
export function toTradeTypedValues(trade: UnsignedTrade): Record<string, unknown> {
  return {
    checks: {
      uses: trade.checks.uses,
      expiration: toSeconds(trade.checks.expiration),
      effective: toSeconds(trade.checks.effective),
      salt: ethers.utils.hexZeroPad(trade.checks.salt, 32),
      contractSignatureIndex: trade.checks.contractSignatureIndex,
      signerSignatureIndex: trade.checks.signerSignatureIndex,
      allowedRoot: ethers.utils.hexZeroPad(bytes(trade.checks.allowedRoot), 32),
      externalChecks: trade.checks.externalChecks.map(check => ({
        contractAddress: check.contractAddress,
        selector: check.selector,
        value: bytes(check.value),
        required: check.required
      }))
    },
    sent: trade.sent.map(asset => ({
      assetType: asset.assetType,
      contractAddress: asset.contractAddress,
      value: assetValue(asset),
      extra: bytes(asset.extra)
    })),
    received: trade.received.map(asset => ({
      assetType: asset.assetType,
      contractAddress: asset.contractAddress,
      value: assetValue(asset),
      extra: bytes(asset.extra),
      beneficiary: asset.beneficiary
    }))
  }
}

/** The marketplace generation a stored trade belongs to (older listings sit on the V1 contract). */
export function getTradeContract(trade: Pick<Trade, 'contract' | 'chainId'>) {
  let name: ContractName = ContractName.OffChainMarketplaceV2
  try {
    name = getContractName(trade.contract)
  } catch {
    // Unknown address: the V2 ABI is the same shape.
  }
  return { ...getContract(name, trade.chainId), address: trade.contract }
}

/** A stored trade in the struct the marketplace contract takes for `cancelSignature` / `accept`. */
export function toOnChainTrade(trade: Trade): OnChainTrade {
  const values = toTradeTypedValues(trade) as Omit<OnChainTrade, 'signer' | 'signature'>
  return {
    signer: trade.signer,
    signature: trade.signature,
    ...values,
    checks: { ...values.checks, allowedProof: [] },
    // Nobody receives the sent asset when cancelling.
    sent: values.sent.map(asset => ({ ...asset, beneficiary: ethers.constants.AddressZero }))
  }
}

export type SignatureIndexes = { contractSignatureIndex: number; signerSignatureIndex: number }

/** The marketplace's current signature indexes; an order signed with stale ones is unredeemable. */
export async function fetchSignatureIndexes(signer: string, chainId: number): Promise<SignatureIndexes> {
  const contract = getOffchainMarketplaceContract(chainId)
  const [contractIndex, signerIndex] = await Promise.all([
    readContract<ethers.BigNumber>(contract, 'contractSignatureIndex'),
    readContract<ethers.BigNumber>(contract, 'signerSignatureIndex', [signer])
  ])
  return { contractSignatureIndex: contractIndex.toNumber(), signerSignatureIndex: signerIndex.toNumber() }
}

/** A stored order: GET /v1/trades/:id. */
export async function fetchTrade(tradeId: string): Promise<Trade> {
  const response = await fetch(`${config.get('MARKETPLACE_SERVER_URL')}/v1/trades/${encodeURIComponent(tradeId)}`)
  const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: Trade } | null
  if (!response.ok || !body?.ok || !body.data)
    throw new Error(`marketplace-server trade ${tradeId} unavailable (${response.status})`)
  return body.data
}

/** marketplace-server still sees an open order for the item: the previous one isn't indexed as cancelled yet. */
export class TradeConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TradeConflictError'
  }
}

/** Stores a signed order: POST /v1/trades. Answers the stored trade id. */
export async function createTrade(address: string, trade: TradeCreation): Promise<string> {
  const response = await signedFetch(
    address,
    config.get('MARKETPLACE_SERVER_URL'),
    '/v1/trades',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trade) },
    TRADE_AUTH_METADATA
  )
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean
    data?: { id?: string }
    message?: string
  } | null
  if (!response.ok || !body?.ok || !body.data?.id) {
    const message = body?.message ?? `marketplace-server rejected the order (${response.status})`
    throw response.status === 409 ? new TradeConflictError(message) : new Error(message)
  }
  return body.data.id
}
