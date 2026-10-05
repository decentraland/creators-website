import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const fill = `linear-gradient(90deg, ${theme.colors.dclRed} 0%, ${theme.colors.amber} 100%)`

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  padding: 32px 0 24px;
`

export const Heading = styled.h3`
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.white};
`

export const Description = styled.p`
  margin: 0 0 40px;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const Label = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.white};
`

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

export const Bar = styled.progress`
  flex: 1;
  height: 10px;
  border: 0;
  border-radius: ${theme.radius.pill};
  overflow: hidden;
  appearance: none;
  background: ${theme.colors.glassHover};

  &::-webkit-progress-bar {
    background: ${theme.colors.glassHover};
  }
  &::-webkit-progress-value {
    border-radius: ${theme.radius.pill};
    background: ${fill};
    transition: width 0.3s ease;
  }
  &::-moz-progress-bar {
    border-radius: ${theme.radius.pill};
    background: ${fill};
  }
`

export const Count = styled.span`
  flex: none;
  font-size: 16px;
  color: ${theme.colors.gray4};
`
