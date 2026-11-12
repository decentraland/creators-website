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

  &[data-stage='approved'] {
    color: ${theme.colors.green};
    border-color: ${theme.colors.green};
    background: ${theme.colors.greenTint};
  }
  &[data-stage='awaiting_curator'],
  &[data-stage='needs_curator'],
  &[data-stage='appealed'] {
    color: ${theme.colors.amber};
    border-color: ${theme.colors.amber};
    background: ${theme.colors.orangeTint};
  }
  &[data-stage='automated_reviewing'] {
    color: ${theme.colors.infoLighter};
    border-color: ${theme.colors.infoLight};
    background: ${theme.colors.infoTint};
  }
  &[data-stage='rejected_by_validator'],
  &[data-stage='rejected_by_curator'] {
    color: ${theme.colors.redBright};
    border-color: ${theme.colors.redBright};
    background: ${theme.colors.redTint};
  }
`
