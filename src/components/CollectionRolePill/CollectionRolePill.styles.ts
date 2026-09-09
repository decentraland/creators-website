import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 1px solid ${theme.colors.glassLine};
  background: ${theme.colors.overlay};
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;
  color: ${theme.colors.softWhite};
`
