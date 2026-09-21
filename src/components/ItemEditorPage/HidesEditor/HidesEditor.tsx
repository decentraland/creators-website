import { useMemo } from 'react'
import { MultiSelect } from '~/components/MultiSelect'
import { InfoTooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { getHideableBodyPartCategories, getHideableWearableCategories } from '~/lib/wearableCategories'
import * as S from './HidesEditor.styles'

type Props = {
  contents: Record<string, unknown>
  category: string | null
  hides: string[]
  disabled?: boolean
  onChange: (hides: string[]) => void
  testId?: string
}

/** Which base body parts and wearable slots the wearable hides on the avatar (legacy Overrides section). */
export function HidesEditor({ contents, category, hides, disabled = false, onChange, testId = 'hides-editor' }: Props) {
  const { t } = useTranslation()
  const bodyParts = useMemo(() => getHideableBodyPartCategories(contents), [contents])
  const wearableCategories = useMemo(
    () => getHideableWearableCategories(contents, category, hides),
    [contents, category, hides]
  )
  const bodyPartOptions = useMemo(
    () => bodyParts.map(value => ({ value, label: t(`item_editor.body_part.${value}`) })),
    [bodyParts, t]
  )
  const categoryOptions = useMemo(
    () => wearableCategories.map(value => ({ value, label: t(`collection_detail_page.category.${value}`) })),
    [wearableCategories, t]
  )
  const hiddenBodyParts = useMemo(() => hides.filter(value => bodyParts.includes(value)), [hides, bodyParts])
  const hiddenCategories = useMemo(() => hides.filter(value => !bodyParts.includes(value)), [hides, bodyParts])

  // Each select owns its half of the list; the other half is carried over untouched.
  const setBodyParts = (values: string[]) => onChange([...values, ...hiddenCategories])
  const setCategories = (values: string[]) => onChange([...hiddenBodyParts, ...values])

  return (
    <>
      <S.Group>
        <S.Label>
          {t('item_editor.overrides.body_parts')}
          <InfoTooltip content={t('item_editor.overrides.body_parts_hint')} testId={`${testId}-body-parts-hint`} />
        </S.Label>
        {bodyPartOptions.length === 0 ? (
          <S.Empty>{t('item_editor.overrides.none_available')}</S.Empty>
        ) : (
          <MultiSelect
            values={hiddenBodyParts}
            options={bodyPartOptions}
            placeholder={t('item_editor.overrides.none_selected')}
            disabled={disabled}
            tone="dark"
            ariaLabel={t('item_editor.overrides.body_parts')}
            testId={`${testId}-body-parts`}
            onChange={setBodyParts}
          />
        )}
      </S.Group>
      <S.Group>
        <S.Label>
          {t('item_editor.overrides.categories')}
          <InfoTooltip content={t('item_editor.overrides.categories_hint')} testId={`${testId}-categories-hint`} />
        </S.Label>
        {categoryOptions.length === 0 ? (
          <S.Empty>{t('item_editor.overrides.none_available')}</S.Empty>
        ) : (
          <MultiSelect
            values={hiddenCategories}
            options={categoryOptions}
            placeholder={t('item_editor.overrides.none_selected')}
            disabled={disabled}
            tone="dark"
            ariaLabel={t('item_editor.overrides.categories')}
            testId={`${testId}-categories`}
            onChange={setCategories}
          />
        )}
      </S.Group>
    </>
  )
}
