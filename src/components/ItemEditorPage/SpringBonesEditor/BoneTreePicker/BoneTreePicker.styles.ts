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
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.chip};
  background: ${theme.editor.bg};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  > svg {
    flex: none;
    width: 18px;
    height: 18px;
  }

  &[data-placeholder] {
    color: ${theme.editor.label};
  }
  &:focus-visible,
  &[aria-expanded='true'] {
    border-color: ${theme.editor.label};
    outline: 0;
  }
  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`

export const Clear = styled.button`
  position: absolute;
  top: 50%;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transform: translateY(-50%);
  border: 0;
  border-radius: ${theme.radius.chip};
  background: transparent;
  color: ${theme.editor.label};
  cursor: pointer;

  > svg {
    width: 16px;
    height: 16px;
  }
  &:hover,
  &:focus-visible {
    color: ${theme.colors.white};
  }
`

// Portaled to <body> and positioned from the trigger's rect, so the editor's panels can't clip it.
export const Tree = styled.ul`
  position: fixed;
  z-index: ${theme.z.tooltip};
  max-height: min(320px, calc(100vh - 16px));
  margin: 0;
  overflow: auto;
  padding: 6px;
  list-style: none;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.editor.surface};
  box-shadow: 0 8px 32px ${theme.colors.overlayStrong};
`

export const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding-right: 8px;
  border-radius: ${theme.radius.chip};
  color: ${theme.colors.white};
  font-size: 12px;
  cursor: pointer;

  > span:last-of-type {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &[data-active] {
    background: ${theme.editor.surfaceHover};
  }
  &[aria-selected='true'] {
    color: ${theme.editor.accent};
  }
  &[data-disabled] {
    color: ${theme.editor.label};
    cursor: default;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const Caret = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: ${theme.editor.label};

  > svg {
    width: 16px;
    height: 16px;
    transition: transform 0.15s ease;
  }
  &[data-open] > svg {
    transform: rotate(90deg);
  }
  &[data-hidden] > svg {
    display: none;
  }
`
