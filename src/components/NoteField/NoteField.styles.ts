import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const TextArea = styled.textarea`
  min-height: 88px;
  padding: 12px 16px;
  border: 1.5px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btnSm};
  background: rgba(255, 255, 255, 0.05);
  color: ${theme.colors.white};
  font: inherit;
  /* 16px keeps iOS from zooming the page on focus. */
  font-size: 16px;
  font-weight: 400;
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
