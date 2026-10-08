import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const pill = `
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.8px solid;
  font: inherit;
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
  &[data-status='missing'] {
    color: ${theme.colors.redBright};
    border-color: ${theme.colors.redBright};
    background: ${theme.colors.redTint};
  }

`

export const Pill = styled.span`
  ${pill}
`

export const PillButton = styled.button`
  ${pill}
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
`
