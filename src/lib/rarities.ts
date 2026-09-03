// Rarity constants shared by every rarity control (pill, select, forms).

export const RARITIES = ['unique', 'mythic', 'exotic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as const

export type RarityName = (typeof RARITIES)[number]

export const DEFAULT_RARITY: RarityName = 'epic'

/** Max supply per rarity (legacy Rarity.getMaxSupply). */
export const RARITY_MAX_SUPPLY: Record<RarityName, number> = {
  unique: 1,
  mythic: 10,
  exotic: 50,
  legendary: 100,
  epic: 1000,
  rare: 5000,
  uncommon: 10000,
  common: 100000
}

export function isRarity(value: string | null | undefined): value is RarityName {
  return !!value && (RARITIES as readonly string[]).includes(value)
}

export function getRarityMaxSupply(rarity: string | null | undefined): number | undefined {
  return isRarity(rarity) ? RARITY_MAX_SUPPLY[rarity] : undefined
}

/** Compact supply for labels: 100 → "100", 1000 → "1K", 100000 → "100K". */
export function formatSupply(supply: number): string {
  if (supply >= 1000 && supply % 1000 === 0) return `${supply / 1000}K`
  return String(supply)
}

/** "Legendary (100)" / "Epic (1K)" — the rarity label every list and form uses. */
export function formatRarityLabel(label: string, rarity: string | null | undefined): string {
  const supply = getRarityMaxSupply(rarity)
  return supply === undefined ? label : `${label} (${formatSupply(supply)})`
}
