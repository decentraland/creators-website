// Calls on the ThirdPartyRegistry (Polygon), ported from the legacy builder's thirdParty sagas and the TP approval
// flow: creators register their third party and buy item slots when publishing; curators set the Merkle root of the
// approved items (consuming the creator's cheque) and enable or disable a third party.
import { ethers } from 'ethers'
import { ContractName, getContract } from 'decentraland-transactions'
import { readContract, type ContractCall } from '~/lib/auth'
import { type SlotsCheque } from '~/lib/builder'
import { toRawMetadata, type ThirdParty } from '~/lib/thirdParty'

export function getThirdPartyRegistry(chainId: number) {
  return getContract(ContractName.ThirdPartyRegistry, chainId)
}

// What the registry stores as the third party's resolver; legacy always sends this placeholder.
const DISABLED_RESOLVER = 'Disabled'

/**
 * Registers a virtual third party on chain and buys its first `slots` (legacy `addThirdParties` on the first
 * publish). `maxPriceWei` caps what the registry may pull in MANA for the slots.
 */
export function buildAddThirdPartyCall(
  chainId: number,
  thirdParty: Pick<ThirdParty, 'id' | 'name' | 'description' | 'contracts' | 'managers' | 'isProgrammatic'>,
  slots: number,
  maxPriceWei: bigint
): ContractCall {
  return {
    contract: getThirdPartyRegistry(chainId),
    method: 'addThirdParties',
    args: [
      [
        [
          thirdParty.id,
          toRawMetadata(thirdParty),
          DISABLED_RESOLVER,
          thirdParty.managers,
          thirdParty.managers.map(() => true),
          String(slots)
        ]
      ],
      [thirdParty.isProgrammatic],
      [maxPriceWei.toString()]
    ]
  }
}

/** Buys `qty` more item slots for a registered third party (legacy `buyItemSlots` on later publishes). */
export function buildBuyItemSlotsCall(
  chainId: number,
  thirdPartyId: string,
  qty: number,
  maxPriceWei: bigint
): ContractCall {
  return {
    contract: getThirdPartyRegistry(chainId),
    method: 'buyItemSlots',
    args: [thirdPartyId, String(qty), maxPriceWei.toString()]
  }
}

/** The cheque as the registry's `consumeSlots` tuple: (qty, salt, sigR, sigS, sigV). */
export type ChequeSlot = [string, string, string, string, number]

export function toChequeSlot(cheque: SlotsCheque): ChequeSlot {
  const { r, s, v } = ethers.utils.splitSignature(cheque.signature)
  return [String(cheque.qty), cheque.salt, r, s, v]
}

/**
 * Sets the Merkle root of the third party's approved items, consuming the creator's cheque for the new slots
 * (an empty `slots` when the cheque was already consumed: a retry, or pushed changes that bought nothing).
 */
export function buildReviewThirdPartyWithRootCall(
  chainId: number,
  thirdPartyId: string,
  root: string,
  slots: ChequeSlot[]
): ContractCall {
  return {
    contract: getThirdPartyRegistry(chainId),
    method: 'reviewThirdPartyWithRoot',
    args: [thirdPartyId, root, slots]
  }
}

/** Enables (`true`) or disables (`false`) a whole third party, every collection under it included. */
export function buildReviewThirdPartyCall(chainId: number, thirdPartyId: string, value: boolean): ContractCall {
  return {
    contract: getThirdPartyRegistry(chainId),
    method: 'reviewThirdParties',
    args: [[[thirdPartyId, value, []]]]
  }
}

export type ThirdPartyPrice = {
  /** USD per item slot, in wei-like 18 decimals as the registry stores it. */
  itemSlotUsdWei: bigint
  /** MANA per item slot at the oracle's current rate. */
  itemSlotManaWei: bigint
  /** Slots a programmatic third party buys in one go, on its first publish. */
  programmaticMinSlots: number
  /** MANA per USD, 18 decimals. */
  manaPerUsdWei: bigint
}

/** The registry's slot price and the programmatic pack size, with the oracle's MANA rate (legacy getThirdPartyPrice). */
export async function fetchThirdPartyPrice(chainId: number): Promise<ThirdPartyPrice> {
  const registry = getThirdPartyRegistry(chainId)
  const oracle = getContract(ContractName.ChainlinkOracle, chainId)
  const [slotPrice, minSlots, rate] = await Promise.all([
    readContract<ethers.BigNumber>(registry, 'itemSlotPrice'),
    readContract<ethers.BigNumber>(registry, 'programmaticBasePurchasedSlots'),
    readContract<ethers.BigNumber>(oracle, 'getRate')
  ])
  const itemSlotUsdWei = BigInt(slotPrice.toString())
  const manaPerUsdWei = BigInt(rate.toString())
  return {
    itemSlotUsdWei,
    itemSlotManaWei: usdToMana(itemSlotUsdWei, manaPerUsdWei),
    programmaticMinSlots: Number(minSlots.toString()),
    manaPerUsdWei
  }
}

const ONE = 10n ** 18n

/** USD (18 decimals) to MANA wei at `manaPerUsdWei`, the oracle's rate: MANA = USD / (USD per MANA). */
export function usdToMana(usdWei: bigint, manaPerUsdWei: bigint): bigint {
  if (manaPerUsdWei === 0n) return 0n
  return (usdWei * ONE) / manaPerUsdWei
}
