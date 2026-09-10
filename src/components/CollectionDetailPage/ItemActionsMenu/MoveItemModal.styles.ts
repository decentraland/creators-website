import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { ModalActions as Actions, Spinner } from '~/styles/shared'

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
  margin-top: 24px;
`

export const Text = styled.p`
  margin: 0;
  font-size: 20px;
  line-height: 1.4;
  color: ${theme.colors.gray4};

  &[data-testid='move-item-empty'] {
    font-size: 16px;
  }
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: ${theme.colors.softWhite};
`

export const Error = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${theme.colors.errLight};
`

export const Loading = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  font-size: 14px;
  color: ${theme.colors.gray4};
`
