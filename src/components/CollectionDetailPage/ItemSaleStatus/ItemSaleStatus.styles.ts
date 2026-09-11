import styled from '@emotion/styled'
import { Button } from '~/components/Button'
import { theme } from '~/styles/theme'

export const PutOnSale = styled(Button)`
  height: 40px;
  min-width: 125px;
  padding: 6px 16px;
  gap: 6px;
  line-height: 1;
  letter-spacing: 0;

  & > svg {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }
`

export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 6px 12px;
  border-radius: ${theme.radius.pill};
  border: 1px solid;
  background: ${theme.colors.text};
  color: ${theme.colors.softWhite};
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;

  &[data-status='on_sale'] {
    border-color: ${theme.colors.successBorder};
  }
  &[data-status='sold_out'] {
    border-color: ${theme.colors.softWhite};
    opacity: 0.7;
  }

  & > svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }
`

export const PillLink = styled(Pill.withComponent('a'))`
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray0};
  }
`

export const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${theme.colors.successBorder};
`
