import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDropDown as ChevronIcon } from '@mui/icons-material'
import * as S from './Select.styles'
import { useListbox } from './useListbox'

export type SelectOption<T extends string> = {
  value: T
  label: string
  /** Leading glyph shown before the label, in the trigger and in the list. */
  icon?: ReactNode
  /** Trailing badge (e.g. a rarity's supply), shown in the list and, unless `triggerLabel` is set, in the trigger. */
  trailing?: ReactNode
  /** Compact text for the closed trigger, replacing `label` + `trailing`. */
  triggerLabel?: string
  /** Draws a separator line above this option (the start of a new group). */
  dividerBefore?: boolean
}

type Props<T extends string> = {
  value: T | null
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  /** `glyph` is a compact trigger showing only the selected option's icon, for a select sitting inside another field. */
  variant?: 'default' | 'glyph'
  /** `dark` sits the select on the editor's dark surfaces instead of the violet ones. */
  tone?: 'default' | 'dark'
  /** A label drawn inside the field, left of the value (the value then aligns right). */
  inlineLabel?: string
  disabled?: boolean
  ariaLabel?: string
  testId?: string
}

const LIST_MIN_WIDTH = { default: 230, glyph: 150 }

/** Custom listbox select: portaled to <body> so scroll containers never clip it, keyboard navigable. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  variant = 'default',
  tone = 'default',
  inlineLabel,
  disabled = false,
  ariaLabel,
  testId = 'select'
}: Props<T>) {
  const { open, active, setActive, wrapRef, listRef, listStyle, listId, toggle, pick, onKeyDown } = useListbox({
    options,
    current: value,
    onPick: onChange,
    minWidth: LIST_MIN_WIDTH[variant]
  })
  const selected = options.find(option => option.value === value)

  return (
    <S.Wrap ref={wrapRef} onKeyDown={onKeyDown}>
      <S.Trigger
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel ?? inlineLabel}
        disabled={disabled}
        data-testid={testId}
        data-value={value ?? undefined}
        data-variant={variant}
        data-tone={tone}
        onClick={toggle}
      >
        {inlineLabel && <S.InlineLabel>{inlineLabel}</S.InlineLabel>}
        {variant === 'glyph' ? (
          <S.OptionLabel title={selected?.label}>{selected?.icon}</S.OptionLabel>
        ) : (
          <S.TriggerLabel data-placeholder={selected ? undefined : true} data-align={inlineLabel ? 'end' : undefined}>
            <S.OptionLabel>
              {selected?.icon}
              <span>{selected ? (selected.triggerLabel ?? selected.label) : placeholder}</span>
            </S.OptionLabel>
            {selected?.trailing && !selected.triggerLabel && <S.Trailing>{selected.trailing}</S.Trailing>}
          </S.TriggerLabel>
        )}
        <ChevronIcon />
      </S.Trigger>
      {open &&
        createPortal(
          <S.Listbox
            ref={listRef}
            role="listbox"
            id={listId}
            data-testid={`${testId}-listbox`}
            data-tone={tone}
            style={listStyle}
            onKeyDown={onKeyDown}
          >
            {options.map(option => (
              <S.OptionGroup key={option.value} data-divider={option.dividerBefore || undefined}>
                <S.Option
                  role="option"
                  aria-selected={option.value === value}
                  data-active={option.value === active || undefined}
                  data-testid={`${testId}-option-${option.value}`}
                  onMouseEnter={() => setActive(option.value)}
                  onMouseLeave={() => setActive(value)}
                  onClick={() => pick(option.value)}
                >
                  <S.OptionLabel>
                    {option.icon}
                    <span>{option.label}</span>
                  </S.OptionLabel>
                  {option.trailing && <S.Trailing>{option.trailing}</S.Trailing>}
                </S.Option>
              </S.OptionGroup>
            ))}
          </S.Listbox>,
          document.body
        )}
    </S.Wrap>
  )
}
