import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Figma "Status Tab": pill, 2px/8px padding, hairline border, tinted fill at low alpha.
export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.5px solid;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;

  &[data-status='published'] {
    color: ${theme.colors.green};
    border-color: ${theme.colors.green};
    background: rgba(52, 206, 119, 0.2); /* successBorder @ 20% */
  }
  &[data-status='under_review'] {
    color: ${theme.colors.amber};
    border-color: ${theme.colors.amber};
    background: rgba(255, 188, 91, 0.2); /* amber @ 20% */
  }
  &[data-status='draft'] {
    color: ${theme.colors.infoLighter};
    border-color: ${theme.colors.infoLight};
    background: rgba(23, 100, 192, 0.4); /* info @ 40% */
  }
`
