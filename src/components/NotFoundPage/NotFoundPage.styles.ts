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
  margin: 0;
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
