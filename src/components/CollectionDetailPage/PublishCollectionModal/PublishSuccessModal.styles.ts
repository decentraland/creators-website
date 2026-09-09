import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
`

export const Art = styled.img`
  max-width: 100%;
  max-height: 150px;
  width: auto;
`

export const Text = styled.p`
  margin: 0 0 24px;
  max-width: 615px;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.6;
  color: ${theme.colors.softWhite};
`
