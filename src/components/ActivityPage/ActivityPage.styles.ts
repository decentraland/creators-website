import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { FooterRow, Panel, PanelText, PanelTitle, ShowingCount } from '~/styles/shared'

const { colors, radius, media } = theme
const mobile = media.maxWidth('mobile')

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;

  ${mobile} {
    gap: 24px;
    padding-top: 12px;
  }
`

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
`

export const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${colors.white};

  ${mobile} {
    font-size: 20px;
  }
`

export const Subtitle = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${colors.gray4};

  ${mobile} {
    font-size: 14px;
  }
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const SkeletonRow = styled.li`
  height: 74px;
  border-radius: ${radius.card};

  ${mobile} {
    height: 96px;
  }
`

export const PanelIcon = styled.div`
  display: flex;
  color: ${colors.white};

  & svg {
    width: 140px;
    height: 140px;
  }

  ${mobile} {
    & svg {
      width: 96px;
      height: 96px;
    }
  }
`
