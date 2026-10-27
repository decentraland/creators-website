import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { ModalActions as Actions } from '~/styles/shared'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
`

export const Icon = styled.div`
  color: ${theme.colors.white};

  svg {
    width: 48px;
    height: 48px;
  }
`

export const Heading = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: ${theme.colors.softWhite};
`

export const Text = styled.p`
  margin: 0 0 24px;
  font-size: 16px;
  line-height: 1.6;
  color: ${theme.colors.softWhite};
`
