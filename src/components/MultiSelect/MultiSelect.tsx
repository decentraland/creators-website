import { createPortal } from 'react-dom'
import { ArrowDropDown as ChevronIcon, Check as CheckIcon } from '@mui/icons-material'
import * as Base from '~/components/Select/Select.styles'
import { useListbox } from '~/components/Select/useListbox'
import * as S from './MultiSelect.styles'

export type MultiSelectOption<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  values: T[]
  options: MultiSelectOption<T>[]
  onChange: (values: T[]) => void
  placeholder?: string
  disabled?: boolean
  tone?: 'default' | 'dark'
  ariaLabel?: string
  testId?: string
}

const LIST_MIN_WIDTH = 230

/** Multiple-choice listbox: the trigger lists the picked labels, options toggle without closing the list. */
export function MultiSelect<T extends string>({
  values,
  options,
  onChange,
  placeholder,
  disabled = false,
  tone = 'default',
  ariaLabel,
  testId = 'multi-select'
}: Props<T>) {
  const { open, active, setActive, wrapRef, listRef, listStyle, listId, toggle, pick, onKeyDown } = useListbox({
    options,
    current: values[0] ?? null,
    onPick: value =>
      onChange(values.includes(value) ? values.filter(candidate => candidate !== value) : [...values, value]),
    keepOpen: true,
    minWidth: LIST_MIN_WIDTH
  })
  const selected = options.filter(option => values.includes(option.value))

  return (
    <Base.Wrap ref={wrapRef} onKeyDown={onKeyDown}>
      <Base.Trigger
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={testId}
        data-tone={tone}
        data-count={values.length}
        onClick={toggle}
      >
        <Base.TriggerLabel data-placeholder={selected.length === 0 ? true : undefined}>
          <S.Summary>{selected.length === 0 ? placeholder : selected.map(option => option.label).join(', ')}</S.Summary>
        </Base.TriggerLabel>
        <ChevronIcon />
      </Base.Trigger>
      {open &&
        createPortal(
          <Base.Listbox
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            id={listId}
            data-testid={`${testId}-listbox`}
            data-tone={tone}
            style={listStyle}
            onKeyDown={onKeyDown}
          >
            {options.map(option => {
              const checked = values.includes(option.value)
              return (
                <Base.OptionGroup key={option.value}>
                  <Base.Option
                    role="option"
                    aria-selected={checked}
                    data-active={option.value === active || undefined}
                    data-testid={`${testId}-option-${option.value}`}
                    onMouseEnter={() => setActive(option.value)}
                    onClick={() => pick(option.value)}
                  >
                    <Base.OptionLabel>
                      <S.Check aria-hidden data-checked={checked || undefined}>
                        {checked && <CheckIcon />}
                      </S.Check>
                      <span>{option.label}</span>
                    </Base.OptionLabel>
                  </Base.Option>
                </Base.OptionGroup>
              )
            })}
          </Base.Listbox>,
          document.body
        )}
    </Base.Wrap>
  )
}
