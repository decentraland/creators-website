import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 100px 0 80px;
  text-align: center;
`

export const BigSpinner = styled.span`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 8px solid ${theme.colors.overlayLight};
  border-top-color: ${theme.colors.dclRed};
  animation: spin 1s linear infinite;
`

export const Label = styled.p`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.white};
`

export const CancelLink = styled.button`
  border: 0;
  background: none;
  padding: 8px 16px;
  font: inherit;
  font-size: 18px;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
