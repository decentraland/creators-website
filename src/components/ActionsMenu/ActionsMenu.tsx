import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import * as S from './ActionsMenu.styles'

type MenuContextValue = { close: () => void }

const MenuContext = createContext<MenuContextValue>({ close: () => {} })

type Props = {
  label: string
  /** Compact 32px trigger for table rows; the default is the page-header icon button. */
  variant?: 'header' | 'row'
  /** Trigger test id; the open menu gets `${testId}-menu`. */
  testId: string
  children: ReactNode
}

/** The ⋯ dropdown: right-aligned, closes on Escape, outside click, or any item click. */
export function ActionsMenu({ label, variant = 'header', testId, children }: Props) {
  const [isOpen, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <S.Wrap ref={wrapRef}>
      <S.Trigger
        variant="secondary"
        size="icon"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-compact={variant === 'row' || undefined}
        data-testid={testId}
        onClick={() => setOpen(open => !open)}
      >
        <MoreHorizIcon fontSize={variant === 'row' ? 'small' : 'medium'} />
      </S.Trigger>
      {isOpen && (
        <MenuContext.Provider value={{ close: () => setOpen(false) }}>
          <S.Menu role="menu" data-testid={`${testId}-menu`}>
            {children}
          </S.Menu>
        </MenuContext.Provider>
      )}
    </S.Wrap>
  )
}

type ItemProps = {
  children: ReactNode
  onClick?: () => void
  /** Inert placeholder for a flow that has not shipped yet; `title` carries the "coming soon" hint. */
  disabled?: boolean
  title?: string
  testId: string
}

export function ActionsMenuItem({ children, onClick, disabled = false, title, testId }: ItemProps) {
  const { close } = useContext(MenuContext)
  return (
    <S.Item
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      title={title}
      data-testid={testId}
      onClick={() => {
        if (disabled) return
        close()
        onClick?.()
      }}
    >
      {children}
    </S.Item>
  )
}

export function ActionsMenuDivider() {
  return <S.Divider />
}
