// Which of a collection's listings a new discount re-prices. A coupon is redeemed by the marketplace a listing was
// signed for, and each marketplace version trusts its own coupon manager, so only orders on the marketplace whose
// manager signs new discounts take one. A collection-store price is bought through CollectionStore, which takes no
// coupon at all.
import { getCouponContracts, getCouponManagerForMarketplace } from '~/lib/coupons'
import { type ItemListing } from '~/lib/listings'

export type DiscountReachOptions = {
  chainId: number
  /** Whether the Shop discounts MANA listings for buyers (`shop-legacy-coupons`); off, only credits listings do. */
  manaListings: boolean
}

/** Whether a new discount re-prices this listing for Shop buyers. */
export function takesDiscount(listing: ItemListing, { chainId, manaListings }: DiscountReachOptions): boolean {
  if (!listing.tradeId || !listing.tradeContract) return false
  if (listing.currency === 'mana' && (!manaListings || listing.manaWei === 0n)) return false
  const manager = getCouponManagerForMarketplace(listing.tradeContract, chainId)
  const signing = getCouponContracts(chainId)?.couponManager.address.toLowerCase()
  return manager !== null && manager === signing
}

export type DiscountReach = {
  /** Listings the discount re-prices. */
  discounted: number
  /** Listings it leaves at their price: a collection-store price, an older marketplace, or MANA while that is off. */
  unchanged: number
  /**
   * The highest discounted price, for the review's example line: the highest because a 1-credit item rounds any
   * discount away. Credits when any credits listing takes it, else MANA wei; null when nothing does.
   */
  example: { credits: number } | { manaWei: bigint } | null
}

export function discountReach(listings: Iterable<ItemListing>, options: DiscountReachOptions): DiscountReach {
  let discounted = 0
  let unchanged = 0
  let credits: number | null = null
  let manaWei: bigint | null = null
  for (const listing of listings) {
    if (!takesDiscount(listing, options)) {
      unchanged++
      continue
    }
    discounted++
    if (listing.currency === 'credits') credits = Math.max(credits ?? 0, listing.credits)
    else if (manaWei === null || listing.manaWei > manaWei) manaWei = listing.manaWei
  }
  const example = credits !== null ? { credits } : manaWei !== null ? { manaWei } : null
  return { discounted, unchanged, example }
}

/** What a credits price rings up at with the discount, rounded up to a whole credit the way checkout does. */
export function discountedCredits(credits: number, pct: number): number {
  return Math.max(1, Math.ceil((credits * (100 - pct)) / 100))
}

/** What a MANA price rings up at: the contract's `price - floor(price * ppm / 1e6)`. */
export function discountedManaWei(manaWei: bigint, pct: number): bigint {
  return manaWei - (manaWei * BigInt(pct * 10_000)) / 1_000_000n
}
