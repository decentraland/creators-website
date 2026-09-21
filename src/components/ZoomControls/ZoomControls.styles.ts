import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const ZoomButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${theme.editor.line};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};
  cursor: pointer;

  &:first-of-type {
    border-radius: ${theme.radius.btnSm} ${theme.radius.btnSm} 0 0;
  }
  &:last-of-type {
    border-radius: 0 0 ${theme.radius.btnSm} ${theme.radius.btnSm};
  }
  &:hover:not(:disabled) {
    background: ${theme.editor.surfaceHover};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`
