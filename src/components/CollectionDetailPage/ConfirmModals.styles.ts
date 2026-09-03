import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`

export const IconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  margin: 10px auto 40px;

  svg {
    width: 48px;
    height: 48px;
  }

  &[data-variant='error'] {
    color: ${theme.colors.amber};
  }
`

export const Art = styled.img`
  display: block;
  height: 125px;
  margin: 0 auto 24px;
`

export const Heading = styled.h3`
  margin: 0 auto 12px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.softWhite};
`

export const Text = styled.p`
  margin: 0 auto 48px;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.3;
  color: ${theme.colors.softWhite};
`

export const Actions = styled.div`
  display: flex;
  gap: 12px;
  width: 100%;
  padding-top: 24px;
  border-top: 0.5px solid ${theme.colors.glassHover};

  > * {
    flex: 1;
    min-width: 0;
  }
`
