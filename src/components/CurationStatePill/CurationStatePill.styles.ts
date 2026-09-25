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

  &[data-state='approved'] {
    color: ${theme.colors.green};
    border-color: ${theme.colors.green};
    background: rgba(48, 205, 0, 0.2); /* green @ 20% */
  }
  &[data-state='under_review'] {
    color: ${theme.colors.amber};
    border-color: ${theme.colors.amber};
    background: rgba(244, 130, 33, 0.2); /* orangeStrong @ 20% */
  }
  &[data-state='to_review'] {
    color: ${theme.colors.infoLighter};
    border-color: ${theme.colors.infoLight};
    background: rgba(23, 100, 192, 0.4); /* info @ 40% */
  }
  &[data-state='rejected'],
  &[data-state='disabled'] {
    color: ${theme.colors.redBright};
    border-color: ${theme.colors.redBright};
    background: rgba(204, 29, 44, 0.2); /* redRejected @ 20% */
  }
`
