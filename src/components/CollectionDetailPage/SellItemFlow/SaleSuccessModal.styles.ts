import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px 0 8px;
  text-align: center;
`

export const Art = styled.img`
  max-width: 100%;
  max-height: 180px;
  width: auto;
  margin-bottom: 16px;
`

export const Heading = styled.h3`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.white};
`

export const Text = styled.p`
  margin: 0 0 32px;
  max-width: 615px;
  font-size: 18px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`
