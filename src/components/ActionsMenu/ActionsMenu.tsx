import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
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

const VIEWPORT_MARGIN = 8
const GAP = 8

/**
 * The ⋯ dropdown: right-aligned under its trigger, closes on Escape, outside click, or any item click.
 * Portaled to <body> and fixed-positioned, like Select, so a scrolling table never clips or grows for it.
 */
export function ActionsMenu({ label, variant = 'header', testId, children }: Props) {
  const [isOpen, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>()

  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
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

  // Anchor the menu's right edge to the trigger; open upward when the viewport has no room below.
  useLayoutEffect(() => {
    if (!isOpen) return
    function position() {
      const trigger = wrapRef.current?.getBoundingClientRect()
      const menu = menuRef.current
      if (!trigger || !menu) return
      const fitsBelow = trigger.bottom + GAP + menu.offsetHeight <= window.innerHeight
      const right = Math.max(VIEWPORT_MARGIN, window.innerWidth - trigger.right)
      setMenuStyle({
        right,
        ...(fitsBelow
          ? { top: trigger.bottom + GAP }
          : { top: Math.max(VIEWPORT_MARGIN, trigger.top - GAP - menu.offsetHeight) })
      })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
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
      {isOpen &&
        createPortal(
          <MenuContext.Provider value={{ close: () => setOpen(false) }}>
            <S.Menu ref={menuRef} role="menu" style={menuStyle} data-testid={`${testId}-menu`}>
              {children}
            </S.Menu>
          </MenuContext.Provider>,
          document.body
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
