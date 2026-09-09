import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  position: relative;
`

export const Trigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btn};
  background: transparent;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;

  &:focus-visible,
  &[aria-expanded='true'] {
    border-color: ${theme.colors.white};
    outline: 0;
  }

  svg {
    flex: none;
    transition: transform 0.15s ease;
  }
  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
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
    color: ${theme.colors.gray4};
  }
`

export const OptionLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

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
`

export const Option = styled.li`
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
`
