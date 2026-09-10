import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const Box = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 54px;
  padding: 0 16px;
  border: 1.5px solid ${theme.colors.white};
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);

  &[data-invalid] {
    background: ${theme.colors.errOverlay};
    border-color: ${theme.colors.errLight};
  }

  & input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    font: inherit;
    font-size: 20px;
    font-weight: 600;
    color: ${theme.colors.white};

    &::placeholder {
      font-weight: 400;
      color: ${theme.colors.gray4};
    }
  }
`

export const CharCount = styled.span`
  flex: none;
  font-size: 14px;
  color: ${theme.colors.media};
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const HintText = styled.p`
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.gray4};

  & svg {
    flex: none;
    font-size: 16px;
  }
`
