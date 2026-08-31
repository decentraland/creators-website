import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Root = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const PageButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.softWhite};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.46px;

  &[aria-label] {
    border: 0.5px solid ${theme.colors.glassLine};
  }
  &:hover:not(:disabled):not([data-current]) {
    background: ${theme.colors.glassFaint};
  }
  &[data-current] {
    background: ${theme.colors.softWhite};
    color: ${theme.colors.text};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`
