import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  border-radius: ${theme.radius.chip};

  &:focus-visible {
    outline: 2px solid ${theme.colors.glassHover};
    outline-offset: 2px;
  }
`
