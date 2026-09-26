import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

export { Centered, Rail, ViewAllLink } from '../OverviewPage.styles'

const { colors, font, media } = theme

const tablet = media.maxWidth('tablet')

export const Section = styled.section`
  position: relative;
  width: 100%;
  padding-bottom: 40px;
  overflow: hidden;
`

export const Title = styled(SectionTitle)`
  margin-bottom: 62px;
`

export const SceneCard = styled.a`
  display: flex;
  flex-direction: column;
  width: 320px;
  min-width: 320px;
  flex-shrink: 0;
  border-radius: 20px;
  background: ${colors.text2};
  color: ${colors.white};
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.35s ease-in-out;

  @media (hover: hover) {
    &:hover {
      transform: scale(1.03);
    }
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${tablet} {
    width: 280px;
    min-width: 280px;
  }
`

export const SceneImage = styled.div`
  position: relative;
  width: 100%;
  height: 180px;

  & img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const OnlineBadge = styled.span`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${colors.badgeOverlay};
  color: ${colors.white};
  font-size: 13px;
  font-weight: 600;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${colors.online};
  }
`

export const SceneInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 20px 20px;
`

export const SceneName = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  letter-spacing: ${font.tracking};
  color: ${colors.softWhite};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SceneCoords = styled.span`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  color: ${colors.muted2};
`
