import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
`

export const Text = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: ${theme.colors.gray4};
`

export const TextArea = styled.textarea`
  min-height: 120px;
  padding: 12px 16px;
  border: 1.5px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btnSm};
  background: rgba(255, 255, 255, 0.05);
  color: ${theme.colors.white};
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;

  &::placeholder {
    color: ${theme.colors.gray4};
  }
  &:focus {
    outline: 0;
    border-color: ${theme.colors.white};
  }
  &:disabled {
    opacity: 0.6;
  }
`

export const CharCount = styled.span`
  align-self: flex-end;
  font-size: 12px;
`

export const Error = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${theme.colors.errLight};
`

export { ModalActions as Actions } from '~/styles/shared'
