// Putting a published item on sale in the Decentraland Shop: enabling sales on the collection (the
// off-chain marketplace becomes a minter of the collection contract) and signing the item's primary
// order. Ported from the legacy builder's SellCollectionModal + PutForSaleOffchainModal, credits-first.
import { ethers } from 'ethers'
import { Network, TradeAssetType, TradeType, type TradeCreation } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import { type ContractCall } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { getItemSales, type Item } from '~/lib/items'
import { type ItemListing } from '~/lib/listings'
import { getManaContract } from '~/lib/mana'
import { USD_CENTS_PER_CREDIT } from '~/lib/publishFee'
import { getOffchainMarketplaceContract, type SignatureIndexes, type UnsignedTrade } from '~/lib/trades'
import { isWalletRejection } from '~/lib/walletErrors'

// 1 credit = $0.10 = 1e17 USD wei (the shop's fixed peg; marketplace-server rounds up to whole credits).
const USD_WEI_PER_CREDIT = 10n ** 17n
// A listing without an expiration date is signed with one far enough away to never matter.
export const NO_EXPIRATION = Date.UTC(2100, 0, 1)
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export type SalePrice = { kind: 'credits'; credits: number } | { kind: 'free' }

export function creditsToUsdWei(credits: number): string {
  return (BigInt(credits) * USD_WEI_PER_CREDIT).toString()
}

/** Whole US dollars with cents — "$5.00" — for a credits amount. */
export function formatCreditsAsUsd(credits: number): string {
  return ((credits * USD_CENTS_PER_CREDIT) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function isValidAddress(value: string): boolean {
  return ethers.utils.isAddress(value)
}

/** Dates are picked in the creator's local time and expire at the end of the chosen day. */
export function parseExpirationDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

/** The earliest date the picker allows: tomorrow, in `YYYY-MM-DD` for the native input. */
export function minExpirationDate(now = Date.now()): string {
  const date = new Date(now + ONE_DAY_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Either generation of the off-chain marketplace as a minter means sales are enabled.
function getSaleMinterAddresses(chainId: number): string[] {
  return [
    getContract(ContractName.OffChainMarketplace, chainId).address,
    getContract(ContractName.OffChainMarketplaceV2, chainId).address
  ].map(address => address.toLowerCase())
}

/** Sales are enabled once the off-chain marketplace may mint the collection's items. */
export function isSalesEnabled(collection: Collection, chainId: number): boolean {
  const minters = new Set(collection.minters.map(address => address.toLowerCase()))
  return getSaleMinterAddresses(chainId).some(address => minters.has(address))
}

/** `setMinters([marketplace], [true])` on the collection contract itself. */
export function buildEnableSalesCall(collection: Collection, chainId: number): ContractCall {
  if (!collection.contractAddress) throw new SellItemError('not_published', 'The collection has no contract yet')
  const contract = { ...getContract(ContractName.ERC721CollectionV2, chainId), address: collection.contractAddress }
  return { contract, method: 'setMinters', args: [[getOffchainMarketplaceContract(chainId).address], [true]] }
}

/** The collection as builder-server will report it once the subgraph catches up with the minters change. */
export function withSalesEnabled(collection: Collection, chainId: number): Collection {
  const minter = getOffchainMarketplaceContract(chainId).address.toLowerCase()
  if (isSalesEnabled(collection, chainId)) return collection
  return { ...collection, minters: [...collection.minters, minter] }
}

export type SellFailureReason = 'rejected' | 'sold_out' | 'not_published' | 'generic'

export class SellItemError extends Error {
  reason: SellFailureReason

  constructor(reason: SellFailureReason, message: string = reason) {
    super(message)
    this.name = 'SellItemError'
    this.reason = reason
  }
}

export function toSellItemError(error: unknown): SellItemError {
  if (error instanceof SellItemError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (isWalletRejection(error)) return new SellItemError('rejected', message)
  return new SellItemError('generic', message)
}

export type SellItemParams = {
  /** The connected wallet: it signs the order and mints on the buyer's behalf. */
  address: string
  chainId: number
  collection: Collection
  item: Item
  price: SalePrice
  /** Who receives the payment; ignored for a giveaway, which pays nobody. */
  beneficiary: string
  /** Unix milliseconds. */
  expiresAt: number
}

/**
 * The primary order for one item: every remaining unit is sellable, paid in USD-pegged MANA (the
 * shop's credits) or, for a giveaway, zero MANA — the legacy encoding the shop understands as free.
 */
export function buildItemOrder(
  params: SellItemParams,
  indexes: SignatureIndexes,
  salt: string,
  now = Date.now()
): UnsignedTrade {
  const { address, chainId, collection, item, price, beneficiary, expiresAt } = params
  if (!collection.contractAddress || !item.tokenId || !item.isPublished) {
    throw new SellItemError('not_published', `Item "${item.id}" is not published`)
  }
  const sales = getItemSales(item)
  if (!sales) throw new SellItemError('generic', `Item "${item.id}" has no rarity`)
  const uses = sales.maxSupply - sales.minted
  if (uses <= 0) throw new SellItemError('sold_out', `Item "${item.id}" is sold out`)

  const mana = getManaContract(chainId).address
  return {
    signer: address,
    network: Network.MATIC,
    chainId,
    type: TradeType.PUBLIC_ITEM_ORDER,
    checks: {
      uses,
      expiration: expiresAt,
      effective: now,
      salt,
      contractSignatureIndex: indexes.contractSignatureIndex,
      signerSignatureIndex: indexes.signerSignatureIndex,
      allowedRoot: '0x',
      externalChecks: []
    },
    sent: [
      {
        assetType: TradeAssetType.COLLECTION_ITEM,
        contractAddress: collection.contractAddress,
        itemId: item.tokenId,
        extra: ''
      }
    ],
    received: [
      price.kind === 'free'
        ? {
            assetType: TradeAssetType.ERC20,
            contractAddress: mana,
            amount: '0',
            extra: '',
            beneficiary: ethers.constants.AddressZero
          }
        : {
            assetType: TradeAssetType.USD_PEGGED_MANA,
            contractAddress: mana,
            amount: creditsToUsdWei(price.credits),
            extra: '',
            beneficiary
          }
    ]
  }
}

export function randomSalt(): string {
  return ethers.utils.hexlify(ethers.utils.randomBytes(32))
}

/** The chain reads, wallet signature and server call the sequence needs, so it can run against fakes in tests. */
export type SellItemDeps = {
  fetchSignatureIndexes: (signer: string, chainId: number) => Promise<SignatureIndexes>
  signTrade: (trade: UnsignedTrade) => Promise<string>
  createTrade: (trade: TradeCreation) => Promise<string>
  /** The wallet prompt is over; the order is being stored. */
  onSigned?: () => void
}

/** Reads the marketplace's signature indexes, signs the order, stores it. Answers the listing as the collection page shows it. */
export async function sellItem(params: SellItemParams, deps: SellItemDeps): Promise<ItemListing> {
  try {
    const indexes = await deps.fetchSignatureIndexes(params.address, params.chainId)
    const trade = buildItemOrder(params, indexes, randomSalt())
    const signature = await deps.signTrade(trade)
    deps.onSigned?.()
    await deps.createTrade({ ...trade, signature })
    const itemId = params.item.tokenId!
    return params.price.kind === 'free'
      ? { itemId, currency: 'mana', manaWei: 0n }
      : { itemId, currency: 'credits', credits: params.price.credits }
  } catch (error) {
    throw toSellItemError(error)
  }
}
