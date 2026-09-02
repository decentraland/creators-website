import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 48px;
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

export const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  line-height: 1.2;
  color: ${theme.colors.media};
`

export const FieldBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 54px;
  padding: 0 16px;
  border: 1.5px solid ${theme.colors.white};
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);

  &[data-invalid] {
    border-color: ${theme.colors.errLight};
  }

  & input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    font: inherit;
    font-size: 16px;
    color: ${theme.colors.white};

    &::placeholder {
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
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const HintText = styled.p`
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.gray4};

  & svg {
    flex: none;
    font-size: 16px;
  }
`

export const Actions = styled.div`
  display: flex;
  gap: 12px;
  /* Separator above the actions, per the modal spec (0.5px white @ 30%). */
  padding-top: 24px;
  border-top: 0.5px solid ${theme.colors.glassHover};

  & > * {
    flex: 1;
    min-width: 0;
  }
`
