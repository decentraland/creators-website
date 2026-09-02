import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { ActionButton } from '~/styles/shared'

export const Root = ActionButton

export const Spinner = styled.span`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: ${theme.colors.white};
  animation: spin 0.8s linear infinite;
`
