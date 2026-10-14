import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

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

export const Fieldset = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
`

export const Legend = styled.legend`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
  padding: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const Hint = styled.span`
  font-size: 13px;
  font-weight: 400;
  color: ${theme.colors.gray4};
`

export const Reasons = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;

  & [data-testid='checkbox-label'] {
    min-height: 32px;
  }

  ${mobile} {
    grid-template-columns: 1fr;
  }
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const TextArea = styled.textarea`
  min-height: 110px;
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
  font-weight: 400;
  color: ${theme.colors.gray4};
`

export const Error = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${theme.colors.errLight};
`

export { ModalActions as Actions } from '~/styles/shared'
