import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Summary = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
`

export const Check = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.chip};

  &[data-checked] {
    border-color: ${theme.editor.accent};
    background: ${theme.editor.accent};
  }

  & svg {
    width: 14px;
    height: 14px;
    color: ${theme.colors.white};
  }
`
