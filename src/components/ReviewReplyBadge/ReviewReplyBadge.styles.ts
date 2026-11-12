import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Badge = styled.span`
  flex: none;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
`
