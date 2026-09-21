import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { theme } from '~/styles/theme'

export const EXPANDED_WIDTH = 314
export const COLLAPSED_WIDTH = 64

// Lets the round toggle hang over the panel edge while the panel itself clips its content.
export const Shell = styled.div`
  position: relative;
  display: flex;
  flex: none;
  height: 100%;
  z-index: 1;
`

// One panel for both modes: the width animates and the text-bearing parts drop out when narrow.
export const Wrap = styled.aside`
  display: flex;
  flex: none;
  flex-direction: column;
  width: ${EXPANDED_WIDTH}px;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid ${theme.editor.line};
  background: ${theme.editor.bg};
  transition: width 200ms ease;

  &[data-collapsed] {
    width: ${COLLAPSED_WIDTH}px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const TOGGLE_SIZE = 28

// Level with the back button (8px header padding + half of its 44px row), half past the border.
export const FloatingToggle = styled.button`
  position: absolute;
  top: ${8 + 22 - TOGGLE_SIZE / 2}px;
  right: ${-TOGGLE_SIZE / 2}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${TOGGLE_SIZE}px;
  height: ${TOGGLE_SIZE}px;
  padding: 0;
  border: 1px solid ${theme.editor.line};
  border-radius: 50%;
  background: ${theme.editor.surface};
  color: ${theme.colors.white};
  box-shadow: 0 2px 8px ${theme.colors.overlayStrong};

  &:hover {
    background: ${theme.editor.surfaceHover};
  }

  & svg {
    font-size: 16px;
  }
`

// Header and list keep the width of the mode they are in, so the panel's width animation clips them
// instead of reflowing (no wrapping names mid-transition).
export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: ${EXPANDED_WIDTH}px;
  padding: 8px;

  [data-collapsed] & {
    width: ${COLLAPSED_WIDTH}px;
    padding: 8px 4px;
  }
`

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;

  [data-collapsed] & {
    justify-content: center;
  }
`

export const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: ${theme.radius.chip};
  background: transparent;
  color: ${theme.colors.white};

  &:hover {
    background: ${theme.editor.surfaceHover};
  }
`

export const IconLink = IconButton.withComponent(Link)

// The pill sits inline after the name; the name ellipsizes rather than wrapping.
export const CollectionName = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 0;

  & [data-testid='collection-status'] {
    flex: none;
  }

  [data-collapsed] & {
    display: none;
  }
`

export const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;

  /* The pencil takes no room until the title is hovered/focused, so the status pill hugs the title. */
  &:hover [data-testid$='-rename'],
  &:focus-within [data-testid$='-rename'] {
    width: 28px;
    margin-left: 4px;
    opacity: 1;
  }
`

export const CollectionTitle = styled.h2`
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const RenameButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 0;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: ${theme.editor.label};
  opacity: 0;
  overflow: hidden;
  transition:
    width 120ms,
    margin 120ms,
    opacity 120ms;

  &:hover {
    background: ${theme.colors.glass};
    color: ${theme.colors.white};
  }

  & svg {
    font-size: 16px;
  }
`

export const HeaderMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 4px;

  [data-collapsed] & {
    justify-content: center;
    padding: 0;
  }

  & > button {
    margin: 5px 0;
  }

  [data-collapsed] & > button {
    margin: 0;
  }
`

export const List = styled.div`
  flex: 1;
  width: ${EXPANDED_WIDTH}px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  /* Collapsed: no scrollbar; the list fades at whichever end still hides items, like the palettes. */
  [data-collapsed] & {
    width: ${COLLAPSED_WIDTH}px;
    padding: 0 4px 8px;
    gap: 8px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
    &[data-fade-start] {
      mask-image: linear-gradient(to bottom, transparent, ${theme.colors.text} 24px);
    }
    &[data-fade-end] {
      mask-image: linear-gradient(to top, transparent, ${theme.colors.text} 24px);
    }
    &[data-fade-start][data-fade-end] {
      mask-image: linear-gradient(
        to bottom,
        transparent,
        ${theme.colors.text} 24px,
        ${theme.colors.text} calc(100% - 24px),
        transparent
      );
    }
  }
`

export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 0 0 4px;
  border-radius: 6px;
  border: 2px solid transparent;
  color: ${theme.colors.white};

  &:hover {
    background: ${theme.editor.surfaceHover};
  }

  &[data-selected] {
    background: ${theme.editor.surfaceHover};
    border-color: ${theme.editor.accent};
  }

  &[data-unavailable] > button:first-of-type {
    opacity: 0.45;
  }

  [data-collapsed] & {
    justify-content: center;
    padding: 0;
  }
`

export const RowButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;

  [data-collapsed] & {
    flex: none;
    justify-content: center;
  }
`

export const Thumb = styled.span`
  position: relative;
  display: block;
  flex: none;
  width: 36px;
  height: 36px;

  & [data-testid='item-thumbnail'] {
    width: 100%;
    height: 100%;
    border-radius: 2px;
  }

  /* Without the eye toggle, a dot on the thumbnail says the item is on the avatar. */
  [data-collapsed] &[data-dressed]::after {
    content: '';
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${theme.colors.ok};
    box-shadow: 0 0 0 2px ${theme.editor.bg};
  }
`

export const RowName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;

  [data-collapsed] & {
    display: none;
  }
`

export const RowGlyph = styled.span`
  display: inline-flex;
  flex: none;
  color: ${theme.editor.label};

  & svg {
    width: 16px;
    height: 16px;
  }

  &[data-playing] {
    color: ${theme.editor.accent};
  }

  [data-collapsed] & {
    display: none;
  }
`

export const DressButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: ${theme.radius.chip};
  background: transparent;
  color: ${theme.editor.label};

  &[aria-pressed='true'] {
    color: ${theme.colors.white};
  }

  &:hover:not(:disabled) {
    background: ${theme.editor.surface};
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  [data-collapsed] & {
    display: none;
  }
`

export const Empty = styled.p`
  margin: 0;
  padding: 24px 8px;
  text-align: center;
  font-size: 14px;
  color: ${theme.editor.label};
`

export const SkeletonRow = styled.div`
  height: 44px;
`

export const PaginationWrap = styled.div`
  width: max-content;
  margin: auto auto 0;
  padding: 8px 0;
`
