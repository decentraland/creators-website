import { createElement, forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cx } from '~/lib/cx'
import styles from './shared.module.css'

type Tag = 'div' | 'span' | 'section' | 'h1' | 'h2' | 'p' | 'button'

// Stand-ins with the names the styled defs had, so importers and their Emotion wrappers keep working until each
// area applies the classes from shared.module.css directly.
function shim<T extends Tag>(tag: T, base: string, name: string) {
  const Shim = forwardRef<HTMLElement, ComponentPropsWithoutRef<T> & { className?: string }>(
    ({ className, ...props }, ref) => createElement(tag, { ...props, ref, className: cx(base, className) })
  )
  Shim.displayName = name
  return Shim
}

export const SearchBox = shim('div', styles.searchBox, 'SearchBox')
export const Spinner = shim('span', styles.spinner, 'Spinner')
export const ModalActions = shim('div', styles.modalActions, 'ModalActions')
export const Panel = shim('section', styles.panel, 'Panel')
export const PanelTitle = shim('h2', styles.panelTitle, 'PanelTitle')
export const PanelText = shim('p', styles.panelText, 'PanelText')
export const FooterRow = shim('div', styles.footerRow, 'FooterRow')
export const ShowingCount = shim('span', styles.showingCount, 'ShowingCount')
export const Page = shim('div', styles.page, 'Page')
export const Header = shim('div', styles.header, 'Header')
export const Title = shim('h1', styles.title, 'Title')
export const Chips = shim('div', styles.chips, 'Chips')
export const Chip = shim('button', styles.chip, 'Chip')
export const SignInIcon = shim('div', styles.signInIcon, 'SignInIcon')
