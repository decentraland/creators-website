import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Figma "Status Tab": pill, 2px/8px padding, hairline border, tinted fill at low alpha.
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
  gap: 4px;
  white-space: nowrap;

  &[data-status='published'] {
    color: ${theme.colors.green};
    border-color: ${theme.colors.green};
    background: ${theme.colors.greenTint};
  }
  &[data-status='under_review'] {
    color: ${theme.colors.amber};
    border-color: ${theme.colors.amber};
    background: ${theme.colors.orangeTint};
  }
  &[data-status='draft'],
  &[data-status='publishing'],
  &[data-status='not_published'] {
    color: ${theme.colors.infoLighter};
    border-color: ${theme.colors.infoLight};
    background: ${theme.colors.infoTint};
  }
  &[data-status='rejected'] {
    color: ${theme.colors.redBright};
    border-color: ${theme.colors.redBright};
    background: ${theme.colors.redTint};
  }
  &[data-status='disabled'] {
    color: ${theme.colors.gray4};
    border-color: ${theme.colors.muted2};
    background: ${theme.colors.mutedTint};
  }
  &[data-status='linked'] {
    color: ${theme.colors.rarityLegendaryLight};
    border-color: ${theme.colors.rarityLegendaryLight};
    background: ${theme.colors.violetTint};

    svg {
      font-size: 16px;
    }
  }
`
