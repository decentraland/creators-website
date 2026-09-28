import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  position: relative;
`

export const Trigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 56px;
  padding: 0 12px;
  border: 1px solid ${theme.colors.muted2};
  border-radius: ${theme.radius.input};
  background: transparent;
  color: ${theme.colors.softWhite};
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-align: left;
  cursor: pointer;

  &:focus-visible,
  &[aria-expanded='true'] {
    border-color: ${theme.colors.white};
    outline: 0;
  }

  > svg {
    flex: none;
    width: 24px;
    height: 24px;
    transition: transform 0.15s ease;
  }
  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }

  &[data-tone='dark'] {
    border-color: ${theme.editor.line};
    background: ${theme.editor.bg};
    color: ${theme.colors.white};

    &:focus-visible,
    &[aria-expanded='true'] {
      border-color: ${theme.editor.label};
    }
  }

  /* A square glyph box; it widens to fit the chevron on hover, focus or while open. */
  &[data-variant='glyph'] {
    display: flex;
    justify-content: center;
    gap: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: ${theme.radius.chip};
    background: ${theme.colors.glass};
    font-size: 20px;
    line-height: 1;
    transition: width 0.15s ease;

    &:hover:not(:disabled),
    &[aria-expanded='true'] {
      background: ${theme.colors.glassHover};
    }
    > svg {
      width: 0;
      height: 18px;
      opacity: 0;
      transition:
        width 0.15s ease,
        opacity 0.15s ease,
        transform 0.15s ease;
    }
    &:hover:not(:disabled),
    &:focus-visible,
    &[aria-expanded='true'] {
      width: 50px;

      > svg {
        width: 18px;
        opacity: 1;
      }
    }
  }
`

export const TriggerLabel = styled.span`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;

  &[data-placeholder] {
    color: ${theme.colors.muted2};
  }

  &[data-align='end'] {
    justify-content: flex-end;
    text-align: right;
  }
`

// Field label inside the trigger, before the value (the legacy attribute dropdowns' look).
export const InlineLabel = styled.span`
  flex: none;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${theme.editor.label};
`

export const OptionLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  > svg,
  > [role='img'] {
    width: 24px;
    height: 24px;
  }

  > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

// Portaled to <body> and positioned from the trigger's rect, so scroll containers can't clip it.
export const Listbox = styled.ul`
  position: fixed;
  z-index: ${theme.z.tooltip};
  max-height: min(360px, calc(100vh - 16px));
  margin: 0;
  overflow-y: auto;
  padding: 6px;
  list-style: none;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.modalSurface};
  box-shadow: 0 8px 32px ${theme.colors.overlayStrong};

  &[data-tone='dark'] {
    border-color: ${theme.editor.line};
    background: ${theme.editor.surface};
  }
`

// Wraps each option so a group boundary can draw its separator without a second list item.
export const OptionGroup = styled.li`
  display: contents;

  &[data-divider]::before {
    content: '';
    display: block;
    height: 1px;
    margin: 6px 4px;
    background: ${theme.colors.glassLine};
  }

  [data-tone='dark'] &[data-divider]::before {
    background: ${theme.editor.line};
  }
`

export const Option = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: ${theme.radius.btnSm};
  color: ${theme.colors.softWhite};
  font-size: 15px;
  cursor: pointer;

  &[data-active] {
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
  }
  &[aria-selected='true'] {
    background: ${theme.colors.glass};
    color: ${theme.colors.white};
  }
`

export const Trailing = styled.span`
  flex: none;
  padding: 4px 10px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.glass};
  color: ${theme.colors.white};
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;

  /* An icon-only badge: square, no pill padding. */
  &:has(> [data-icon-badge]) {
    display: inline-flex;
    padding: 4px;
  }
`
