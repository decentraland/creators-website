import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Content = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 40px;
`

export const HeaderIcon = styled.span`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.amber};

  &[data-variant='errors'] {
    background: ${theme.colors.errorOverlay};
    color: ${theme.colors.errLight};
  }
`

export const Title = styled.h2`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
`

export const Intro = styled.p`
  margin: 0;
  color: ${theme.colors.softWhite};
  font-size: 16px;
  line-height: 1.5;
`

export const List = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 32px;
  min-height: 0;
  overflow-y: auto;
`

export const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid ${theme.colors.glassHover};

  &[data-single] {
    justify-content: center;
  }

  & > button {
    min-width: 240px;
  }

  ${mobile} {
    flex-direction: column-reverse;

    & > button {
      min-width: 0;
      width: 100%;
    }
  }
`
