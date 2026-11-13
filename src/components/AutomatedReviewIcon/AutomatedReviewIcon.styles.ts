import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Glyph = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  font-size: 20px;
  color: ${theme.colors.gray4};

  &[data-status='passed'] {
    color: ${theme.colors.ok};
  }
  &[data-status='rejected'] {
    color: ${theme.colors.errLight};
  }
  &[data-status='unsupported'] {
    color: ${theme.colors.amber};
  }
`

export const Spinner = styled.span`
  width: 14px;
  height: 14px;
  border: 2px solid ${theme.colors.glassHover};
  border-top-color: ${theme.colors.white};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
`
