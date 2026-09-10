import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 48px;
  margin-top: 48px;
`

export const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
`

export const Heading = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.33;
  color: ${theme.colors.white};
`

export const Subtitle = styled.p`
  margin: 0;
  font-size: 20px;
  line-height: 1.33;
  color: ${theme.colors.gray4};
`

export { ModalActions as Actions } from '~/styles/shared'
