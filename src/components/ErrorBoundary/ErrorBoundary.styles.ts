import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 120px 24px;
  text-align: center;
`

export const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};
`

export const Text = styled.p`
  margin: 0;
  max-width: 640px;
  font-size: 16px;
  line-height: 1.6;
  color: ${theme.colors.softWhite};
`

export const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  min-width: 180px;
  padding: 0 12px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.dclRed};
  color: ${theme.colors.white};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.46px;
  text-transform: uppercase;
  transition: background 0.15s ease;

  &:hover {
    background: ${theme.colors.dclRedHover};
  }
`
