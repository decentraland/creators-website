import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.8px solid;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;

  &[data-status='published'] {
    color: ${theme.colors.green};
    border-color: ${theme.colors.green};
    background: ${theme.colors.greenTint};
  }
  &[data-status='modified'] {
    color: ${theme.colors.infoLighter};
    border-color: ${theme.colors.infoLight};
    background: ${theme.colors.infoTint};
  }
  &[data-status='under_review'] {
    color: ${theme.colors.amber};
    border-color: ${theme.colors.amber};
    background: ${theme.colors.orangeTint};
  }
  &[data-status='rejected'],
  &[data-status='missing'] {
    color: ${theme.colors.redBright};
    border-color: ${theme.colors.redBright};
    background: ${theme.colors.redTint};
  }
`
