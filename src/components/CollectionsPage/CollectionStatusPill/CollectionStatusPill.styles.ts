import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

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
    background: rgba(48, 205, 0, 0.2);
  }
  &[data-status='under_review'] {
    color: #ffbc5b;
    border-color: #ffbc5b;
    background: rgba(255, 188, 91, 0.2);
  }
  &[data-status='draft'] {
    color: ${theme.colors.gray4};
    border-color: ${theme.colors.gray4};
    background: ${theme.colors.glass};
  }
`
