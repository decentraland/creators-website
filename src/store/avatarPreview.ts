// Session-only state of the preview mannequin: who it is (body shape, colors, base outfit), what it
// wears from the collection, and which emote plays. The editor and the live preview share it.
import { BodyShape, PreviewEmote } from '@dcl/schemas'
import { create } from 'zustand'
import {
  getRandomBaseWearables,
  getRandomBodyShape,
  getRandomColors,
  toBaseWearableUrns,
  type AvatarAttributes,
  type AvatarColors,
  type BaseWearable,
  type BaseWearableCategory,
  type BaseWearableSelection
} from '~/lib/avatar'
import { ItemType } from '~/lib/items'

/** What the avatar needs to know about an item to dress it: one emote and one wearable per slot at a time. */
type Dressable = { id: string; type: ItemType; category?: string }

export type AvatarPreviewState = AvatarColors & {
  bodyShape: BodyShape
  /** The base outfit per body shape; null until the catalog has been seeded. */
  baseWearables: Record<BodyShape, BaseWearableSelection> | null
  dressedItemIds: string[]
  emote: PreviewEmote
  isPlaying: boolean
  setBodyShape: (bodyShape: BodyShape) => void
  setColor: (slot: keyof AvatarColors, hex: string) => void
  setBaseWearable: (bodyShape: BodyShape, category: BaseWearableCategory, urn: string | null) => void
  /** First random outfit once the catalog loads; a no-op when one is already set. */
  seedBaseWearables: (catalog: BaseWearable[]) => void
  /** Re-rolls body shape, colors and outfit. */
  randomize: (catalog: BaseWearable[]) => void
  /** Adds an item to the avatar; it replaces any dressed emote (for an emote) or wearable of the same category. */
  dress: (item: Dressable) => void
  undress: (itemId: string) => void
  toggleDressed: (item: Dressable) => void
  setDressed: (items: Dressable[]) => void
  clearDressed: () => void
  setEmote: (emote: PreviewEmote) => void
  setPlaying: (isPlaying: boolean) => void
}

const initialColors = getRandomColors()

export const useAvatarPreview = create<AvatarPreviewState>()((set, get) => ({
  bodyShape: getRandomBodyShape(),
  ...initialColors,
  baseWearables: null,
  dressedItemIds: [],
  emote: PreviewEmote.IDLE,
  isPlaying: false,
  setBodyShape: bodyShape => set({ bodyShape }),
  setColor: (slot, hex) => set({ [slot]: hex }),
  setBaseWearable: (bodyShape, category, urn) =>
    set(state => {
      const current = state.baseWearables ?? emptySelections()
      return { baseWearables: { ...current, [bodyShape]: { ...current[bodyShape], [category]: urn } } }
    }),
  seedBaseWearables: catalog => {
    if (get().baseWearables) return
    set({
      baseWearables: {
        [BodyShape.MALE]: getRandomBaseWearables(catalog, BodyShape.MALE),
        [BodyShape.FEMALE]: getRandomBaseWearables(catalog, BodyShape.FEMALE)
      }
    })
  },
  randomize: catalog => {
    const bodyShape = getRandomBodyShape()
    set(state => ({
      bodyShape,
      ...getRandomColors(),
      baseWearables: {
        ...(state.baseWearables ?? emptySelections()),
        [bodyShape]: getRandomBaseWearables(catalog, bodyShape)
      }
    }))
  },
  dress: item => set(state => ({ dressedItemIds: dressOne(state.dressedItemIds, item) })),
  undress: itemId => set(state => ({ dressedItemIds: state.dressedItemIds.filter(id => id !== itemId) })),
  toggleDressed: item =>
    set(state =>
      state.dressedItemIds.includes(item.id)
        ? { dressedItemIds: state.dressedItemIds.filter(id => id !== item.id) }
        : { dressedItemIds: dressOne(state.dressedItemIds, item) }
    ),
  setDressed: items => set({ dressedItemIds: items.reduce<string[]>((ids, item) => dressOne(ids, item), []) }),
  clearDressed: () =>
    set(() => {
      dressedKinds.clear()
      return { dressedItemIds: [] }
    }),
  setEmote: emote => set({ emote }),
  setPlaying: isPlaying => set({ isPlaying })
}))

// The store keeps ids only; what every dressed id is (type and slot) is remembered here so a newly
// dressed item can push out the one it competes with: the emote already playing, or the wearable
// already occupying the same category slot (the preview would only show the last one anyway).
const dressedKinds = new Map<string, { type: ItemType; category?: string }>()

function competes(a: { type: ItemType; category?: string }, b: { type: ItemType; category?: string }): boolean {
  if (a.type !== b.type) return false
  if (a.type === ItemType.EMOTE) return true
  return a.category !== undefined && a.category === b.category
}

function dressOne(ids: string[], item: Dressable): string[] {
  dressedKinds.set(item.id, { type: item.type, category: item.category })
  const keep = ids.filter(id => {
    if (id === item.id) return true
    const kind = dressedKinds.get(id)
    return !kind || !competes(kind, item)
  })
  return keep.includes(item.id) ? keep : [...keep, item.id]
}

function emptySelections(): Record<BodyShape, BaseWearableSelection> {
  const empty: BaseWearableSelection = { hair: null, facial_hair: null, upper_body: null, lower_body: null }
  return { [BodyShape.MALE]: { ...empty }, [BodyShape.FEMALE]: { ...empty } }
}

/** The attributes the preview iframe needs, derived from the store. */
export function selectAvatarAttributes(state: AvatarPreviewState): AvatarAttributes {
  return {
    bodyShape: state.bodyShape,
    skin: state.skin,
    eyes: state.eyes,
    hair: state.hair,
    baseWearableUrns: toBaseWearableUrns(state.baseWearables?.[state.bodyShape], state.bodyShape)
  }
}
