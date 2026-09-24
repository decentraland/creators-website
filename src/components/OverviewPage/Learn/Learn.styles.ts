import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

export { Rail } from '../OverviewPage.styles'

const { colors, media } = theme

const mobile = media.maxWidth('mobile')
const stacked = media.maxWidth('lg')

export const Section = styled.section`
  width: 100%;
  overflow: hidden;
`

export const Title = styled(SectionTitle)`
  margin: 80px auto 54px;
  padding: 0 16px;

  ${mobile} {
    margin: 48px auto 32px;
  }
`

export const VideoCard = styled.a`
  display: flex;
  flex: 0 0 529px;
  flex-direction: column;
  border-radius: 20px;
  overflow: hidden;
  color: ${colors.white};

  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${mobile} {
    flex-basis: min(360px, calc(100vw - 32px));
  }
`

export const Thumbnail = styled.div`
  position: relative;
  height: 236px;

  & img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  & svg {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 80px;
    height: 80px;
    color: ${colors.white};
    opacity: 0.7;
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 4px 20px ${colors.overlayHover});
    transition: opacity 0.35s ease-in-out;
  }
  a:hover & svg {
    opacity: 1;
  }

  ${mobile} {
    height: 160px;
  }
`

export const VideoInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  background: ${colors.text2};
`

export const VideoMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 24px;
`

export const VideoAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${colors.muted2};

  & img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  ${mobile} {
    font-size: 16px;
  }
`

export const VideoDate = styled.span`
  flex: none;
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
  color: ${colors.muted2};

  ${mobile} {
    font-size: 14px;
  }
`

export const VideoTitle = styled.h3`
  margin: 0;
  padding: 0 24px 32px;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;

  ${mobile} {
    font-size: 18px;
  }
`

export const Extras = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 32px 80px;
  margin: 64px 16px;

  ${mobile} {
    flex-direction: column;
    align-items: stretch;
    margin: 32px 16px;
  }
`

export const Extra = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: ${colors.white};

  ${stacked} {
    flex-direction: column;
  }
  ${mobile} {
    font-size: 18px;

    & a {
      width: 100%;
    }
  }
`
