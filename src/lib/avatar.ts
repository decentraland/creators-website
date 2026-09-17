// The preview avatar's attributes: legacy palettes (modules/editor/avatar.ts Color4 lists as hex) and
// the base-avatars catalog picks that dress the mannequin under the item being edited.
import { BodyShape, WearableCategory } from '@dcl/schemas'

type Rgb = [number, number, number]

/** Hex without '#', the form the preview's `skin` / `eyes` / `hair` options take. */
export function rgbToHex([r, g, b]: Rgb): string {
  return [r, g, b]
    .map(channel =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
}

const SKIN_RGB: Rgb[] = [
  [1, 0.8941177, 0.7764706],
  [1, 0.8666667, 0.7372549],
  [0.9490196, 0.7607843, 0.6470588],
  [0.8666667, 0.6941177, 0.5607843],
  [0.8, 0.6078432, 0.4666667],
  [0.6039216, 0.4627451, 0.3568628],
  [0.4392157, 0.3647059, 0.2784314],
  [0.4392157, 0.2980392, 0.2196078],
  [0.3215686, 0.172549, 0.1098039],
  [0.2352941, 0.1333333, 0.08627451]
]

const HAIR_RGB: Rgb[] = [
  [0.1098039, 0.1098039, 0.1098039],
  [0.2352941, 0.1294118, 0.04313726],
  [0.3568628, 0.1921569, 0.05882353],
  [0.4823529, 0.282353, 0.09411765],
  [0.5960785, 0.372549, 0.2156863],
  [0.5490196, 0.1254902, 0.07843138],
  [0.9137255, 0.509804, 0.2039216],
  [1, 0.7450981, 0.1568628]
]

const EYE_RGB: Rgb[] = [
  [0.2117647, 0.1490196, 0.1490196],
  [0.372549, 0.2235294, 0.1960784],
  [0.5254902, 0.3803922, 0.2588235],
  [0.7490196, 0.6196079, 0.3529412],
  [0.5294118, 0.5019608, 0.4705882],
  [0.6862745, 0.772549, 0.7803922],
  [0.1254902, 0.7019608, 0.9647059],
  [0.2235294, 0.4862745, 0.6901961],
  [0.282353, 0.8627451, 0.4588235],
  [0.2313726, 0.6235294, 0.3137255]
]

export const SKIN_COLORS: string[] = SKIN_RGB.map(rgbToHex)
export const HAIR_COLORS: string[] = HAIR_RGB.map(rgbToHex)
export const EYE_COLORS: string[] = EYE_RGB.map(rgbToHex)

export const BODY_SHAPES = [BodyShape.MALE, BodyShape.FEMALE] as const

/** Base-avatar slots the customizer exposes, in display order. */
export const BASE_WEARABLE_CATEGORIES = [
  WearableCategory.HAIR,
  WearableCategory.FACIAL_HAIR,
  WearableCategory.UPPER_BODY,
  WearableCategory.LOWER_BODY
] as const

export type BaseWearableCategory = (typeof BASE_WEARABLE_CATEGORIES)[number]

/** One entry of the Catalyst `base-avatars` collection, trimmed to what the customizer needs. */
export type BaseWearable = {
  urn: string
  category: WearableCategory
  bodyShapes: BodyShape[]
  name: string
}

/** The URN picked per slot; `null` leaves the slot empty (facial hair is nullable). */
export type BaseWearableSelection = Record<BaseWearableCategory, string | null>

export type AvatarColors = { skin: string; eyes: string; hair: string }

/** Everything the preview needs to dress the mannequin, besides the items themselves. */
export type AvatarAttributes = AvatarColors & {
  bodyShape: BodyShape
  baseWearableUrns: string[]
}

export function pickRandom<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(random() * items.length)]
}

export function getRandomBodyShape(random: () => number = Math.random): BodyShape {
  return pickRandom(BODY_SHAPES, random) ?? BodyShape.MALE
}

export function getRandomColors(random: () => number = Math.random): AvatarColors {
  return {
    skin: pickRandom(SKIN_COLORS, random) ?? SKIN_COLORS[0],
    eyes: pickRandom(EYE_COLORS, random) ?? EYE_COLORS[0],
    hair: pickRandom(HAIR_COLORS, random) ?? HAIR_COLORS[0]
  }
}

/** Catalog entries of one slot that exist for the given body shape. */
export function filterBaseWearables(
  catalog: BaseWearable[],
  category: WearableCategory,
  bodyShape: BodyShape
): BaseWearable[] {
  return catalog.filter(wearable => wearable.category === category && wearable.bodyShapes.includes(bodyShape))
}

/** A random outfit per slot, like the legacy editor's boot: the female shape gets no facial hair. */
export function getRandomBaseWearables(
  catalog: BaseWearable[],
  bodyShape: BodyShape,
  random: () => number = Math.random
): BaseWearableSelection {
  const pick = (category: WearableCategory) =>
    pickRandom(filterBaseWearables(catalog, category, bodyShape), random)?.urn ?? null
  return {
    [WearableCategory.HAIR]: pick(WearableCategory.HAIR),
    [WearableCategory.FACIAL_HAIR]: bodyShape === BodyShape.FEMALE ? null : pick(WearableCategory.FACIAL_HAIR),
    [WearableCategory.UPPER_BODY]: pick(WearableCategory.UPPER_BODY),
    [WearableCategory.LOWER_BODY]: pick(WearableCategory.LOWER_BODY)
  }
}

/**
 * Slots the customizer does not expose but the mannequin still needs dressed, per body shape: the
 * default shoes the legacy editor always added (the preview leaves the avatar barefoot otherwise).
 */
export const FIXED_BASE_WEARABLES: Record<BodyShape, string[]> = {
  [BodyShape.MALE]: ['urn:decentraland:off-chain:base-avatars:sneakers'],
  [BodyShape.FEMALE]: ['urn:decentraland:off-chain:base-avatars:bun_shoes']
}

/** The urns the preview dresses the mannequin with: the picked slots plus the fixed ones for the shape. */
export function toBaseWearableUrns(
  selection: BaseWearableSelection | null | undefined,
  bodyShape: BodyShape
): string[] {
  const picked = selection
    ? BASE_WEARABLE_CATEGORIES.flatMap(category => (selection[category] ? [selection[category]] : []))
    : []
  return [...picked, ...FIXED_BASE_WEARABLES[bodyShape]]
}

/** "urn:…:f_jeans_00" → "Jeans", "hair_02" → "Hair 3" (legacy getName). */
export function getBaseWearableName(urn: string): string {
  let name = urn.split(':').pop() ?? urn
  if (name.startsWith('f_') || name.startsWith('m_')) name = name.slice(2)
  return name
    .split('_')
    .map(part => {
      const numeric = Number(part)
      if (Number.isNaN(numeric)) return part
      return numeric <= 0 ? null : String(numeric + 1)
    })
    .filter((part): part is string => part !== null && part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
