import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
`

export const Text = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const Error = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${theme.colors.errLight};
`

export { ModalActions as Actions } from '~/styles/shared'
