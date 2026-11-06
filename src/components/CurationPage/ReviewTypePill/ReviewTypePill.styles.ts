import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.8px solid;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;

  &[data-type='new'] {
    color: ${theme.colors.rarityLegendaryLight};
    border-color: ${theme.colors.magenta};
    background: ${theme.colors.violetTint};
  }
  &[data-type='updates'] {
    color: ${theme.colors.softWhite};
    border-color: ${theme.colors.glassLine};
    background: ${theme.colors.glassFaint};
  }
`
