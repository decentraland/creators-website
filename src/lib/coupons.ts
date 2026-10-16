// Collection discounts in the Decentraland Shop: a creator signs a discount coupon over their collection and the
// marketplace applies it to the collection's listings at checkout, so the listings keep their price and the
// discount ends by itself when its window closes. marketplace-server stores and validates the coupon
// (`/v1/coupons`); this module builds, signs, stores, lists and ends one. Ported from the shop's lib/coupons.
import { ethers } from 'ethers'
import { Network, type TradeChecks } from '@dcl/schemas'
import { ContractName, getContract, getContractName, getCouponManager } from 'decentraland-transactions'
import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { config } from '~/config'
import { readContract, signedFetch, type ContractCall, type ContractData } from '~/lib/auth'
import { OFFCHAIN_MARKETPLACE_TYPES, getOffchainMarketplaceContract } from '~/lib/trades'
import { isWalletRejection } from '~/lib/walletErrors'

/** Percentage discount, in parts per million on-chain: 30% is 300_000. The only type this app signs. */
export const DISCOUNT_TYPE_RATE = 1
export const MIN_DISCOUNT_PCT = 5
export const MAX_DISCOUNT_PCT = 70
export const MAX_DISCOUNT_DURATION_MS = 30 * 24 * 60 * 60 * 1000
/** The `uses` a discount is signed with when it has no unit limit: the contract needs a number nobody reaches. */
export const UNCAPPED_USES = 1_000_000

const COUPON_AUTH_METADATA = { signer: 'dcl:builder', intent: 'dcl:create-coupon' }

export type DiscountStatus = 'scheduled' | 'active' | 'ended' | 'cancelled' | 'exhausted' | 'revoked'

/** A discount as marketplace-server reports it (`GET /v1/coupons`). `checks` timestamps are milliseconds. */
export type CollectionDiscount = {
  id: string
  signer: string
  chainId: number
  network: string
  checks: TradeChecks
  couponManager: string
  couponAddress: string
  discountType: number
  discount: number
  root: string
  collections: string[]
  signature: string
  createdAt: number
  state: { uses: number; cancelled: boolean; revoked: boolean; checkedAt: number } | null
  status: DiscountStatus
}

/** What `POST /v1/coupons` takes: the signed fields plus the collections the root was built from. */
export type CouponCreation = {
  signer: string
  chainId: number
  network: Network
  checks: TradeChecks
  couponAddress: string
  discountType: number
  discount: number
  collections: string[]
  signature: string
}

type CouponContracts = { couponManager: ContractData & { name: string; version: string }; coupon: string }

function managerOf(marketplace: ContractName, chainId: number): CouponContracts['couponManager'] {
  const manager = getCouponManager(marketplace, chainId)
  return { ...manager, chainId }
}

/**
 * The coupon deployment a NEW discount is signed against, or null where coupons do not exist. Each marketplace
 * version trusts its own manager, so it is the manager of the marketplace this app lists on, never the chain's
 * `ContractName.CouponManager`, which on Polygon mainnet still names the previous version's.
 */
export function getCouponContracts(chainId: number): CouponContracts | null {
  try {
    const marketplace = getOffchainMarketplaceContract(chainId)
    return {
      couponManager: managerOf(getContractName(marketplace.address), chainId),
      coupon: getContract(ContractName.CollectionDiscountCoupon, chainId).address
    }
  } catch {
    return null
  }
}

/**
 * The manager whose coupons a listing on `marketplaceAddress` redeems, lower-cased, or null when that marketplace
 * pairs with none. A discount reaches a listing only when this is the manager it was signed against.
 */
export function getCouponManagerForMarketplace(marketplaceAddress: string, chainId: number): string | null {
  try {
    return getCouponManager(getContractName(marketplaceAddress), chainId).address.toLowerCase()
  } catch {
    return null
  }
}

const MARKETPLACES_WITH_COUPONS = [ContractName.OffChainMarketplaceV2, ContractName.OffChainMarketplaceV3]

/** The registry's manager at `address` on `chainId`, so a cancellation is only ever sent to a contract it vouches for. */
function findCouponManager(chainId: number, address: string): CouponContracts['couponManager'] | null {
  const wanted = address.toLowerCase()
  for (const marketplace of MARKETPLACES_WITH_COUPONS) {
    try {
      const manager = managerOf(marketplace, chainId)
      if (manager.address.toLowerCase() === wanted) return manager
    } catch {
      continue
    }
  }
  return null
}

/** Lower-cased and de-duplicated, so the same set of collections always hashes to the same root. */
export function normalizeCollections(collections: string[]): string[] {
  return [...new Set(collections.map(collection => collection.toLowerCase()))]
}

/**
 * The Merkle root the coupon is signed over, laid out with OpenZeppelin's StandardMerkleTree: marketplace-server
 * rebuilds it the same way, and a different layout would make it reject the coupon.
 */
export function collectionsRoot(collections: string[]): string {
  const unique = normalizeCollections(collections)
  if (unique.length === 0) throw new DiscountInputError('collections')
  return StandardMerkleTree.of(
    unique.map(collection => [collection]),
    ['address']
  ).root
}

/** `abi.encode(CollectionDiscountCouponData)`: what the creator signs and the contract decodes. */
export function encodeCouponData(discountPpm: number, root: string): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes32'], [DISCOUNT_TYPE_RATE, discountPpm, root])
}

export const COUPON_TYPES: Record<string, ethers.TypedDataField[]> = {
  Coupon: [
    { name: 'checks', type: 'Checks' },
    { name: 'couponAddress', type: 'address' },
    { name: 'data', type: 'bytes' }
  ],
  Checks: OFFCHAIN_MARKETPLACE_TYPES.Checks,
  ExternalCheck: OFFCHAIN_MARKETPLACE_TYPES.ExternalCheck
}

const toSeconds = (ms: number) => Math.floor(ms / 1000)

export function couponDomain(chainId: number, contracts: CouponContracts): ethers.TypedDataDomain {
  return {
    name: contracts.couponManager.name,
    version: contracts.couponManager.version,
    salt: ethers.utils.hexZeroPad(ethers.utils.hexlify(chainId), 32),
    verifyingContract: contracts.couponManager.address
  }
}

function onChainChecks(checks: TradeChecks) {
  return {
    uses: checks.uses,
    expiration: toSeconds(checks.expiration),
    effective: toSeconds(checks.effective),
    salt: ethers.utils.hexZeroPad(checks.salt, 32),
    contractSignatureIndex: checks.contractSignatureIndex,
    signerSignatureIndex: checks.signerSignatureIndex,
    allowedRoot: ethers.utils.hexZeroPad(checks.allowedRoot || '0x', 32),
    externalChecks: []
  }
}

/** The EIP-712 values for a coupon: `checks` in seconds, the way the contract reads them. */
export function couponTypedValues(checks: TradeChecks, couponAddress: string, data: string) {
  return { checks: onChainChecks(checks), couponAddress, data }
}

/** The manager's current signature indexes for `signer`: a coupon signed below them is already revoked. */
export async function readCouponIndexes(
  manager: ContractData,
  signer: string
): Promise<{ contractSignatureIndex: number; signerSignatureIndex: number }> {
  const [contractIndex, signerIndex] = await Promise.all([
    readContract<ethers.BigNumber>(manager, 'contractSignatureIndex'),
    readContract<ethers.BigNumber>(manager, 'signerSignatureIndex', [signer])
  ])
  return { contractSignatureIndex: contractIndex.toNumber(), signerSignatureIndex: signerIndex.toNumber() }
}

export type DiscountInputProblem = 'collections' | 'pct' | 'window' | 'duration' | 'uses'

/** Terms the contract, the server or the product would refuse. The UI maps the code to copy. */
export class DiscountInputError extends Error {
  constructor(public problem: DiscountInputProblem) {
    super(`Invalid discount: ${problem}`)
    this.name = 'DiscountInputError'
  }
}

export type DiscountTerms = {
  collections: string[]
  /** Whole percent, 5 to 70. */
  discountPct: number
  /** Epoch ms. Omitted = starts now. */
  startsAtMs?: number
  /** Epoch ms. */
  endsAtMs: number
  /** How many discounted purchases it allows. Omitted = no limit. */
  uses?: number
}

/** Rejects terms the contract, the server or the product would refuse, before anything is signed. */
export function validateDiscountTerms(terms: DiscountTerms, now = Date.now()): void {
  if (normalizeCollections(terms.collections).length === 0) throw new DiscountInputError('collections')
  if (
    !Number.isInteger(terms.discountPct) ||
    terms.discountPct < MIN_DISCOUNT_PCT ||
    terms.discountPct > MAX_DISCOUNT_PCT
  ) {
    throw new DiscountInputError('pct')
  }
  const startsAt = terms.startsAtMs ?? now
  if (!(terms.endsAtMs > now) || !(terms.endsAtMs > startsAt)) throw new DiscountInputError('window')
  if (terms.endsAtMs - Math.max(startsAt, now) > MAX_DISCOUNT_DURATION_MS) throw new DiscountInputError('duration')
  if (terms.uses !== undefined && (!Number.isInteger(terms.uses) || terms.uses < 1))
    throw new DiscountInputError('uses')
}

export type DiscountFailureReason = 'rejected' | 'generic'

export class DiscountError extends Error {
  constructor(
    public reason: DiscountFailureReason,
    message: string = reason
  ) {
    super(message)
    this.name = 'DiscountError'
  }
}

export function toDiscountError(error: unknown): DiscountError {
  if (error instanceof DiscountError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new DiscountError(isWalletRejection(error) ? 'rejected' : 'generic', message)
}

export type CreateDiscountDeps = {
  /** The manager's `contractSignatureIndex` and the signer's `signerSignatureIndex`. */
  readIndexes: (
    manager: ContractData,
    signer: string
  ) => Promise<{ contractSignatureIndex: number; signerSignatureIndex: number }>
  signTypedData: (
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ) => Promise<string>
  postCoupon: (payload: CouponCreation) => Promise<CollectionDiscount>
  /** The wallet prompt is over; the discount is being stored. */
  onSigned?: () => void
  now?: () => number
  randomSalt?: () => string
}

/** Signs the discount (one EIP-712 signature, no transaction) and stores it, so the Shop starts applying it. */
export async function createDiscount(
  params: DiscountTerms & { signer: string; chainId: number },
  deps: CreateDiscountDeps
): Promise<CollectionDiscount> {
  const now = deps.now ? deps.now() : Date.now()
  validateDiscountTerms(params, now)
  const contracts = getCouponContracts(params.chainId)
  if (!contracts) throw new DiscountError('generic', `Coupons are not available on chain ${params.chainId}`)

  try {
    const signer = params.signer.toLowerCase()
    const collections = normalizeCollections(params.collections)
    const indexes = await deps.readIndexes(contracts.couponManager, signer)
    const checks: TradeChecks = {
      uses: params.uses ?? UNCAPPED_USES,
      expiration: params.endsAtMs,
      effective: params.startsAtMs ?? now,
      salt: deps.randomSalt ? deps.randomSalt() : ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      contractSignatureIndex: indexes.contractSignatureIndex,
      signerSignatureIndex: indexes.signerSignatureIndex,
      allowedRoot: '0x',
      externalChecks: []
    }
    const discount = params.discountPct * 10_000
    const data = encodeCouponData(discount, collectionsRoot(collections))
    const signature = await deps.signTypedData(
      couponDomain(params.chainId, contracts),
      COUPON_TYPES,
      couponTypedValues(checks, contracts.coupon, data)
    )
    deps.onSigned?.()
    return await deps.postCoupon({
      signer,
      chainId: params.chainId,
      network: Network.MATIC,
      checks,
      couponAddress: contracts.coupon,
      discountType: DISCOUNT_TYPE_RATE,
      discount,
      collections,
      signature
    })
  } catch (error) {
    throw toDiscountError(error)
  }
}

/** Stores a signed discount. Signed request: the server checks the caller is the signer. */
export async function postCoupon(address: string, payload: CouponCreation): Promise<CollectionDiscount> {
  const response = await signedFetch(
    address,
    config.get('MARKETPLACE_SERVER_URL'),
    '/v1/coupons',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    COUPON_AUTH_METADATA
  )
  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    data?: CollectionDiscount
    message?: string
  }
  if (!response.ok || !json.ok || !json.data) {
    throw new DiscountError('generic', json.message ?? `marketplace-server rejected the discount (${response.status})`)
  }
  return json.data
}

/** A creator's discounts, newest first, with their last known state. Public: coupons are public signatures. */
export async function fetchCreatorDiscounts(address: string): Promise<CollectionDiscount[]> {
  const response = await fetch(
    `${config.get('MARKETPLACE_SERVER_URL')}/v1/coupons?${new URLSearchParams({ signer: address.toLowerCase() })}`
  )
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`marketplace-server request failed: /v1/coupons (${response.status})`)
  }
  const json = (await response.json()) as { data?: CollectionDiscount[] }
  return json.data ?? []
}

/** The server's status, refreshed against the clock: a discount it called active may have ended since. */
export function liveDiscountStatus(
  discount: Pick<CollectionDiscount, 'status' | 'checks'>,
  now = Date.now()
): DiscountStatus {
  if (discount.status === 'cancelled' || discount.status === 'revoked' || discount.status === 'exhausted') {
    return discount.status
  }
  if (discount.checks.expiration <= now) return 'ended'
  if (discount.checks.effective > now) return 'scheduled'
  return 'active'
}

/** The collection's discounts that still matter (running or yet to start), soonest-ending first. */
export function openDiscountsFor(
  discounts: CollectionDiscount[],
  contractAddress: string,
  now = Date.now()
): CollectionDiscount[] {
  const collection = contractAddress.toLowerCase()
  return discounts
    .filter(discount => discount.collections.some(c => c.toLowerCase() === collection))
    .filter(discount => {
      const status = liveDiscountStatus(discount, now)
      return status === 'active' || status === 'scheduled'
    })
    .sort((a, b) => a.checks.expiration - b.checks.expiration)
}

/** Whether the creator limited how many discounted purchases it allows. */
export function isDiscountCapped(discount: Pick<CollectionDiscount, 'checks'>): boolean {
  return discount.checks.uses < UNCAPPED_USES
}

/** Whole percent off, as the creator typed it. */
export function discountPct(discount: Pick<CollectionDiscount, 'discount'>): number {
  return Math.round(discount.discount / 10_000)
}

/**
 * `CouponManager.cancelSignature([coupon])` on the manager the discount was SIGNED against: cancelling on another
 * manager succeeds and changes nothing where the coupon redeems. The CouponManager takes no meta-transactions, so
 * this has to be sent from the wallet on the coupon's chain.
 */
export function buildEndDiscountCall(discount: CollectionDiscount): ContractCall {
  const manager = findCouponManager(discount.chainId, discount.couponManager)
  if (!manager) {
    throw new DiscountError('generic', `Unknown coupon manager ${discount.couponManager} on chain ${discount.chainId}`)
  }
  return {
    contract: manager,
    method: 'cancelSignature',
    args: [
      [
        {
          signature: discount.signature,
          checks: { ...onChainChecks(discount.checks), allowedProof: [] },
          couponAddress: discount.couponAddress,
          data: encodeCouponData(discount.discount, discount.root),
          callerData: '0x'
        }
      ]
    ]
  }
}

export type EndDiscountDeps = {
  sendTransaction: (call: ContractCall) => Promise<string>
  waitForTransaction: (txHash: string) => Promise<boolean>
  /** The wallet prompt is over; the cancellation is mining. */
  onSigned?: () => void
}

/** Ends a discount early and waits for the receipt; the Shop stops applying it on the server's next state read. */
export async function endDiscount(discount: CollectionDiscount, deps: EndDiscountDeps): Promise<void> {
  try {
    const txHash = await deps.sendTransaction(buildEndDiscountCall(discount))
    deps.onSigned?.()
    if (!(await deps.waitForTransaction(txHash))) {
      throw new DiscountError('generic', 'The end discount transaction reverted')
    }
  } catch (error) {
    throw toDiscountError(error)
  }
}
