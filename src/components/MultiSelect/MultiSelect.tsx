import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDropDown as ChevronIcon, Check as CheckIcon } from '@mui/icons-material'
import * as Base from '~/components/Select/Select.styles'
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
const VIEWPORT_MARGIN = 8

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
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<T | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [listStyle, setListStyle] = useState<CSSProperties>()
  const listId = useId()
  const selected = options.filter(option => values.includes(option.value))

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (!wrapRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const trigger = wrapRef.current?.getBoundingClientRect()
      const listHeight = listRef.current?.offsetHeight ?? 0
      if (!trigger) return
      const gap = 6
      const fitsBelow = trigger.bottom + gap + listHeight <= window.innerHeight
      const width = Math.max(trigger.width, LIST_MIN_WIDTH)
      const left = Math.max(VIEWPORT_MARGIN, Math.min(trigger.left, window.innerWidth - width - VIEWPORT_MARGIN))
      setListStyle({
        left,
        width,
        ...(fitsBelow
          ? { top: trigger.bottom + gap }
          : { top: Math.max(VIEWPORT_MARGIN, trigger.top - gap - listHeight) })
      })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  function toggleOpen() {
    if (!open) setActive(options[0]?.value ?? null)
    setOpen(!open)
  }

  function toggleValue(value: T) {
    onChange(values.includes(value) ? values.filter(candidate => candidate !== value) : [...values, value])
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggleOpen()
      }
      return
    }
    const index = options.findIndex(option => option.value === active)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive(options[Math.min(index + 1, options.length - 1)]?.value ?? null)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(options[Math.max(index - 1, 0)]?.value ?? null)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (active !== null) toggleValue(active)
        break
      case 'Escape':
        event.stopPropagation()
        setOpen(false)
        break
    }
  }

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
        onClick={toggleOpen}
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
                <Base.Option
                  key={option.value}
                  role="option"
                  aria-selected={checked}
                  data-active={option.value === active || undefined}
                  data-testid={`${testId}-option-${option.value}`}
                  onMouseEnter={() => setActive(option.value)}
                  onClick={() => toggleValue(option.value)}
                >
                  <Base.OptionLabel>
                    <S.Check aria-hidden data-checked={checked || undefined}>
                      {checked && <CheckIcon />}
                    </S.Check>
                    <span>{option.label}</span>
                  </Base.OptionLabel>
                </Base.Option>
              )
            })}
          </Base.Listbox>,
          document.body
        )}
    </Base.Wrap>
  )
}
