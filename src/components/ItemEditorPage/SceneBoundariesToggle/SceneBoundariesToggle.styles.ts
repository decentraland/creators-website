import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};

  &:hover,
  &[data-active] {
    background: ${theme.editor.surfaceHover};
  }
`
