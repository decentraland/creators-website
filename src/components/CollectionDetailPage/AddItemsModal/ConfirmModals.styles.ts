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

export const Heading = styled.h3`
  margin: 0 auto 16px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.softWhite};
`

export const Text = styled.p`
  margin: 0 auto 32px;
  font-size: 20px;
  line-height: 1.3;
  color: ${theme.colors.gray4};
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
