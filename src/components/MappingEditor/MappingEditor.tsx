import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AllInclusive as AnyIcon,
  FormatListNumbered as MultipleIcon,
  LinearScale as RangeIcon,
  Tag as SingleIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import {
  MappingType,
  TOKEN_ID_MAX_LENGTH,
  fromMappingDraft,
  toMappingDraft,
  type Mapping,
  type MappingDraft
} from '~/lib/mappings'
import { Select, type SelectOption } from '~/components/Select'
import { InfoTooltip } from '~/components/Tooltip'
import * as S from './MappingEditor.styles'

type Props = {
  value: Mapping | null
  /** Fires on every edit; `mapping` is null while the draft is incomplete or invalid. */
  onChange: (mapping: Mapping | null, draft: MappingDraft) => void
  disabled?: boolean
  /** `dark` sits the editor on the item editor's dark surfaces. */
  tone?: 'default' | 'dark'
  /** One-line layout for table rows. */
  compact?: boolean
  /** Shows the "what is this" tooltip next to the type select. */
  withHelp?: boolean
  /** Names the controls as a group, so several editors on one screen (one per row) can be told apart. */
  groupLabel?: string
  testId?: string
}

const TYPES = [MappingType.ANY, MappingType.SINGLE, MappingType.MULTIPLE, MappingType.RANGE]
const ICONS = {
  [MappingType.ANY]: <AnyIcon fontSize="small" />,
  [MappingType.SINGLE]: <SingleIcon fontSize="small" />,
  [MappingType.MULTIPLE]: <MultipleIcon fontSize="small" />,
  [MappingType.RANGE]: <RangeIcon fontSize="small" />
}
const DIGITS_AND_SEPARATORS = /[^\d\s,;]/g
const DIGITS = /\D/g

/** Which tokens of the linked contract unlock the item: all of them, one, a list, or a range of ids. */
export function MappingEditor({
  value,
  onChange,
  disabled = false,
  tone = 'default',
  compact = false,
  withHelp = true,
  groupLabel,
  testId = 'mapping-editor'
}: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<MappingDraft>(() => toMappingDraft(value))
  // A value coming back from the server replaces the draft only while the draft still shows the previous value: what
  // the user typed while a save was in flight wins over that save's refetch. Drafts are compared, not mappings, so an
  // item without one (the empty draft) also follows a mapping saved elsewhere.
  const valueKey = JSON.stringify(value)
  const previousValue = useRef(value)
  useEffect(() => {
    const untouchedDraft = JSON.stringify(toMappingDraft(previousValue.current))
    previousValue.current = value
    setDraft(current => (JSON.stringify(current) === untouchedDraft ? toMappingDraft(value) : current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey])

  const options = useMemo<SelectOption<MappingType>[]>(
    () => TYPES.map(type => ({ value: type, label: t(`mapping_editor.type.${type}`), icon: ICONS[type] })),
    [t]
  )
  const invalid = useMemo(() => fromMappingDraft(draft) === null, [draft])

  function update(patch: Partial<MappingDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(fromMappingDraft(next), next)
  }

  return (
    <S.Editor
      role={groupLabel ? 'group' : undefined}
      aria-label={groupLabel}
      data-compact={compact || undefined}
      data-tone={tone}
      data-testid={testId}
    >
      <S.TypeCell>
        <Select
          value={draft.type}
          options={options}
          disabled={disabled}
          tone={tone}
          variant={compact ? 'compact' : 'default'}
          ariaLabel={t('mapping_editor.label')}
          testId={`${testId}-type`}
          onChange={type => update({ type })}
        />
        {withHelp && !compact && (
          <InfoTooltip
            content={
              <S.Help>
                <strong>{t('mapping_editor.help.title')}</strong>
                {TYPES.map(type => (
                  <span key={type}>
                    <b>{t(`mapping_editor.type.${type}`)}</b>: {t(`mapping_editor.help.${type}`)}
                  </span>
                ))}
              </S.Help>
            }
            testId={`${testId}-help`}
          />
        )}
      </S.TypeCell>
      {draft.type === MappingType.SINGLE && (
        <S.Input
          value={draft.id}
          inputMode="numeric"
          maxLength={TOKEN_ID_MAX_LENGTH}
          placeholder={t('mapping_editor.single_placeholder')}
          aria-label={t('mapping_editor.type.single')}
          disabled={disabled}
          data-invalid={(invalid && draft.id !== '') || undefined}
          data-size="short"
          data-testid={`${testId}-id`}
          onChange={event => update({ id: event.target.value.replace(DIGITS, '') })}
        />
      )}
      {draft.type === MappingType.MULTIPLE && (
        <S.Input
          as={compact ? 'input' : 'textarea'}
          value={draft.ids}
          placeholder={t('mapping_editor.multiple_placeholder')}
          aria-label={t('mapping_editor.type.multiple')}
          disabled={disabled}
          data-invalid={(invalid && draft.ids.trim() !== '') || undefined}
          data-testid={`${testId}-ids`}
          onChange={event => update({ ids: event.target.value.replace(DIGITS_AND_SEPARATORS, '') })}
        />
      )}
      {draft.type === MappingType.RANGE && (
        <S.RangeRow data-range>
          <S.Input
            value={draft.from}
            inputMode="numeric"
            maxLength={TOKEN_ID_MAX_LENGTH}
            placeholder={t('mapping_editor.from')}
            aria-label={t('mapping_editor.from')}
            disabled={disabled}
            data-invalid={(invalid && draft.from !== '' && draft.to !== '') || undefined}
            data-testid={`${testId}-from`}
            onChange={event => update({ from: event.target.value.replace(DIGITS, '') })}
          />
          <S.RangeDash aria-hidden>–</S.RangeDash>
          <S.Input
            value={draft.to}
            inputMode="numeric"
            maxLength={TOKEN_ID_MAX_LENGTH}
            placeholder={t('mapping_editor.to')}
            aria-label={t('mapping_editor.to')}
            disabled={disabled}
            data-invalid={(invalid && draft.from !== '' && draft.to !== '') || undefined}
            data-testid={`${testId}-to`}
            onChange={event => update({ to: event.target.value.replace(DIGITS, '') })}
          />
        </S.RangeRow>
      )}
      {invalid && !compact && <S.ErrorText data-testid={`${testId}-error`}>{t('mapping_editor.invalid')}</S.ErrorText>}
    </S.Editor>
  )
}
