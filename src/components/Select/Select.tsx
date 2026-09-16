import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDropDown as ChevronIcon } from '@mui/icons-material'
import * as S from './Select.styles'

export type SelectOption<T extends string> = {
  value: T
  label: string
  /** Leading glyph shown before the label, in the trigger and in the list. */
  icon?: ReactNode
  /** Trailing badge (e.g. a rarity's supply), shown in the list and, unless `triggerLabel` is set, in the trigger. */
  trailing?: ReactNode
  /** Compact text for the closed trigger, replacing `label` + `trailing`. */
  triggerLabel?: string
}

type Props<T extends string> = {
  value: T | null
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  /** `glyph` is a compact trigger showing only the selected option's icon, for a select sitting inside another field. */
  variant?: 'default' | 'glyph'
  disabled?: boolean
  ariaLabel?: string
  testId?: string
}

const LIST_MIN_WIDTH = { default: 230, glyph: 150 }
const VIEWPORT_MARGIN = 8

/** Custom listbox select: portaled to <body> so scroll containers never clip it, keyboard navigable. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  variant = 'default',
  disabled = false,
  ariaLabel,
  testId = 'select'
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<T | null>(value)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [listStyle, setListStyle] = useState<CSSProperties>()
  const listId = useId()
  const selected = options.find(option => option.value === value)

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (!wrapRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // Anchor the list to the trigger; open upward when the viewport has no room below.
  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const trigger = wrapRef.current?.getBoundingClientRect()
      const listHeight = listRef.current?.offsetHeight ?? 0
      if (!trigger) return
      const gap = 6
      const fitsBelow = trigger.bottom + gap + listHeight <= window.innerHeight
      // A list wider than its trigger keeps its left edge but never spills past the viewport.
      const width = Math.max(trigger.width, LIST_MIN_WIDTH[variant])
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
  }, [open, variant])

  function toggle() {
    if (!open) setActive(value ?? options[0]?.value ?? null)
    setOpen(!open)
  }

  function select(next: T) {
    onChange(next)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle()
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
        if (active !== null) select(active)
        break
      case 'Escape':
        // Stop the surrounding modal from closing on the same keypress.
        event.stopPropagation()
        setOpen(false)
        break
    }
  }

  return (
    <S.Wrap ref={wrapRef} onKeyDown={onKeyDown}>
      <S.Trigger
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={testId}
        data-value={value ?? undefined}
        data-variant={variant}
        onClick={toggle}
      >
        {variant === 'glyph' ? (
          <S.OptionLabel title={selected?.label}>{selected?.icon}</S.OptionLabel>
        ) : (
          <S.TriggerLabel data-placeholder={selected ? undefined : true}>
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
            style={listStyle}
            onKeyDown={onKeyDown}
          >
            {options.map(option => (
              <S.Option
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                data-active={option.value === active || undefined}
                data-testid={`${testId}-option-${option.value}`}
                onMouseEnter={() => setActive(option.value)}
                onMouseLeave={() => setActive(value)}
                onClick={() => select(option.value)}
              >
                <S.OptionLabel>
                  {option.icon}
                  <span>{option.label}</span>
                </S.OptionLabel>
                {option.trailing && <S.Trailing>{option.trailing}</S.Trailing>}
              </S.Option>
            ))}
          </S.Listbox>,
          document.body
        )}
    </S.Wrap>
  )
}
