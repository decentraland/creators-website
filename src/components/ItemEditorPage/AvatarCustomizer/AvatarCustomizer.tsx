import { useEffect, useMemo, useRef } from 'react'
import { BodyShape, WearableCategory } from '@dcl/schemas'
import {
  Casino as RandomIcon,
  Close as CloseIcon,
  Female as FemaleIcon,
  Male as MaleIcon,
  Person as PersonIcon
} from '@mui/icons-material'
import { Button } from '~/components/Button'
import { Select } from '~/components/Select'
import { useScrollFades } from '~/hooks/useScrollFades'
import { useTranslation } from '~/intl'
import {
  BASE_WEARABLE_CATEGORIES,
  BODY_SHAPES,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
  filterBaseWearables,
  type AvatarColors,
  type BaseWearable,
  type BaseWearableCategory
} from '~/lib/avatar'
import { useAvatarPreview } from '~/store/avatarPreview'
import * as S from './AvatarCustomizer.styles'

type ToggleProps = {
  open: boolean
  onToggle: () => void
  testId?: string
}

/** The overlay button that opens and closes the customizer drawer. */
export function AvatarCustomizerToggle({ open, onToggle, testId = 'avatar-customizer' }: ToggleProps) {
  const { t } = useTranslation()
  return (
    <S.ToggleButton
      type="button"
      aria-expanded={open}
      data-open={open || undefined}
      data-testid={`${testId}-toggle`}
      onClick={onToggle}
    >
      <PersonIcon fontSize="small" />
      {t('item_editor.customizer.title')}
    </S.ToggleButton>
  )
}

type SwatchRowProps = {
  label: string
  colors: string[]
  value: string
  onChange: (hex: string) => void
  testId: string
}

/** A palette that scrolls sideways when the field is too narrow, with fades marking the hidden ends. */
function SwatchRow({ label, colors, value, onChange, testId }: SwatchRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollFades(ref)
  return (
    <S.Swatches ref={ref} role="radiogroup" aria-label={label}>
      {colors.map(hex => (
        <S.Swatch
          key={hex}
          type="button"
          role="radio"
          aria-checked={value === hex}
          aria-label={`#${hex}`}
          data-selected={value === hex || undefined}
          data-testid={`${testId}-${hex}`}
          style={{ background: `#${hex}` }}
          onClick={() => onChange(hex)}
        />
      ))}
    </S.Swatches>
  )
}

type DrawerProps = {
  /** The base-avatars catalog; the outfit selects wait for it. */
  catalog: BaseWearable[] | undefined
  onClose: () => void
  testId?: string
}

const NONE = '__none__'

type Slot =
  | { kind: 'shape' }
  | { kind: 'color'; slot: keyof AvatarColors; colors: string[] }
  | { kind: 'wearable'; category: BaseWearableCategory; nullable: boolean }

// Two columns, read left to right then top to bottom.
const SLOTS: Slot[] = [
  { kind: 'shape' },
  { kind: 'color', slot: 'skin', colors: SKIN_COLORS },
  { kind: 'color', slot: 'hair', colors: HAIR_COLORS },
  { kind: 'color', slot: 'eyes', colors: EYE_COLORS },
  { kind: 'wearable', category: WearableCategory.HAIR, nullable: false },
  { kind: 'wearable', category: WearableCategory.UPPER_BODY, nullable: false },
  { kind: 'wearable', category: WearableCategory.FACIAL_HAIR, nullable: true },
  { kind: 'wearable', category: WearableCategory.LOWER_BODY, nullable: false }
]

/**
 * Body shape, skin / hair / eyes colors and the base outfit of the preview mannequin. Sits under the
 * preview (a bottom drawer, like the legacy editor's attributes bar) so the avatar stays visible.
 */
export function AvatarCustomizerDrawer({ catalog, onClose, testId = 'avatar-customizer' }: DrawerProps) {
  const { t } = useTranslation()
  const bodyShape = useAvatarPreview(state => state.bodyShape)
  const skin = useAvatarPreview(state => state.skin)
  const eyes = useAvatarPreview(state => state.eyes)
  const hair = useAvatarPreview(state => state.hair)
  const baseWearables = useAvatarPreview(state => state.baseWearables)
  const setBodyShape = useAvatarPreview(state => state.setBodyShape)
  const setColor = useAvatarPreview(state => state.setColor)
  const setBaseWearable = useAvatarPreview(state => state.setBaseWearable)
  const randomize = useAvatarPreview(state => state.randomize)
  const colors: AvatarColors = { skin, eyes, hair }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const optionsByCategory = useMemo(
    () =>
      Object.fromEntries(
        BASE_WEARABLE_CATEGORIES.map(category => [
          category,
          filterBaseWearables(catalog ?? [], category, bodyShape).map(wearable => ({
            value: wearable.urn,
            label: wearable.name
          }))
        ])
      ) as Record<BaseWearableCategory, Array<{ value: string; label: string }>>,
    [catalog, bodyShape]
  )
  const selection = baseWearables?.[bodyShape]

  function renderSlot(slot: Slot) {
    if (slot.kind === 'shape') {
      return (
        <S.FieldBox key="shape">
          <S.Label>{t('item_editor.customizer.body_shape')}</S.Label>
          <S.Segmented role="radiogroup" aria-label={t('item_editor.customizer.body_shape')}>
            {BODY_SHAPES.map(shape => {
              const name = shape === BodyShape.MALE ? 'male' : 'female'
              return (
                <S.SegmentButton
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={bodyShape === shape}
                  data-selected={bodyShape === shape || undefined}
                  data-testid={`${testId}-shape-${name}`}
                  onClick={() => setBodyShape(shape)}
                >
                  {shape === BodyShape.MALE ? <MaleIcon fontSize="small" /> : <FemaleIcon fontSize="small" />}
                  {t(`item_editor.customizer.shape.${name}`)}
                </S.SegmentButton>
              )
            })}
          </S.Segmented>
        </S.FieldBox>
      )
    }
    if (slot.kind === 'color') {
      return (
        <S.FieldBox key={slot.slot}>
          <S.Label>{t(`item_editor.customizer.${slot.slot}`)}</S.Label>
          <SwatchRow
            label={t(`item_editor.customizer.${slot.slot}`)}
            colors={slot.colors}
            value={colors[slot.slot]}
            testId={`${testId}-${slot.slot}`}
            onChange={hex => setColor(slot.slot, hex)}
          />
        </S.FieldBox>
      )
    }
    const options = slot.nullable
      ? [{ value: NONE, label: t('item_editor.customizer.none') }, ...optionsByCategory[slot.category]]
      : optionsByCategory[slot.category]
    // "Hair" alone would clash with the hair color swatches above it.
    const label =
      slot.category === WearableCategory.HAIR
        ? t('item_editor.customizer.hair_style')
        : t(`collection_detail_page.category.${slot.category}`)
    return (
      <S.Field key={slot.category} data-select>
        <Select
          value={selection?.[slot.category] ?? (slot.nullable ? NONE : null)}
          options={options}
          disabled={!catalog}
          tone="dark"
          inlineLabel={label}
          testId={`${testId}-${slot.category}`}
          onChange={value => setBaseWearable(bodyShape, slot.category, value === NONE ? null : value)}
        />
      </S.Field>
    )
  }

  return (
    <S.Drawer role="region" aria-label={t('item_editor.customizer.drawer_title')} data-testid={`${testId}-drawer`}>
      <S.DrawerHeader>
        <S.DrawerTitle>{t('item_editor.customizer.drawer_title')}</S.DrawerTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!catalog}
          data-testid={`${testId}-randomize`}
          onClick={() => catalog && randomize(catalog)}
        >
          <RandomIcon fontSize="small" />
          {t('item_editor.customizer.randomize')}
        </Button>
        <S.CloseButton type="button" aria-label={t('modal.close')} data-testid={`${testId}-close`} onClick={onClose}>
          <CloseIcon fontSize="small" />
        </S.CloseButton>
      </S.DrawerHeader>
      <S.Grid>{SLOTS.map(renderSlot)}</S.Grid>
    </S.Drawer>
  )
}
