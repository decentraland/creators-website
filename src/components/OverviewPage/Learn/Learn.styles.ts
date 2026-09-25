import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

export { Rail } from '../OverviewPage.styles'

const { colors, font, media } = theme

const mobileUp = media.minWidth('mobile')
const tablet = media.maxWidth('tablet')
const laptopUp = media.minWidth('laptop')
const desktop = media.maxWidth('desktop')

export const Section = styled.section`
  position: relative;
  width: 100%;
  overflow: hidden;
`

export const Title = styled(SectionTitle)`
  margin: 97px auto 62px;
`

export const VideoCard = styled.a`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 529px;
  min-width: 529px;
  height: 398px;
  flex-shrink: 0;
  border-radius: 20px;
  overflow: hidden;
  color: ${colors.white};
  cursor: pointer;
  transition: transform 0.35s ease-in-out;

  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${tablet} {
    width: 360px;
    min-width: 360px;
    max-width: 360px;
    height: 310px;
  }
`

export const Thumbnail = styled.div`
  position: relative;
  flex: 1;
  width: 100%;
  height: 236px;
  cursor: pointer;

  & img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px 10px 0 0;
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
    transition: all 0.35s ease-in-out;
  }
  &:hover svg {
    opacity: 1;
    filter: drop-shadow(0 4px 20px ${colors.overlayHover}) brightness(1.3);
  }

  ${tablet} {
    height: 160px;
  }
`

export const VideoInfo = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: 0 0 20px 20px;
  background: ${colors.text2};
`

export const VideoMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 18px 24px;
`

export const VideoAuthor = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;

  & img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }
  & span {
    margin-left: 8px;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: ${font.tracking};
    color: ${colors.muted2};
  }

  ${tablet} {
    & span {
      font-size: 16px;
    }
  }
`

export const VideoDate = styled.span`
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  text-align: right;
  text-transform: uppercase;
  color: ${colors.muted2};

  ${tablet} {
    font-size: 16px;
  }
`

export const VideoTitle = styled.h3`
  margin: 0;
  padding: 0 24px 40px;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  letter-spacing: ${font.tracking};

  ${tablet} {
    font-size: 18px;
    text-align: left;
  }
`

export const Extras = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 72px 20px;

  ${tablet} {
    flex-direction: column;
    gap: 32px;
    margin: 28px 0 32px;
    padding: 0 16px;
  }
`

export const Extra = styled.div`
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 600;
  line-height: 48px;
  text-align: center;
  color: ${colors.white};

  & a {
    margin-left: 16px;
  }
  &:first-of-type {
    ${laptopUp} {
      margin-right: 80px;
    }
  }
  &:last-of-type {
    ${mobileUp} {
      margin-top: 33px;
    }
    ${laptopUp} {
      margin-top: 0;
    }
  }

  ${desktop} {
    flex-direction: column;
  }
  ${tablet} {
    gap: 16px;
    width: 100%;
    font-size: 18px;
    line-height: 1.4;

    &:first-of-type,
    &:last-of-type {
      margin: 0;
    }
    & a {
      width: 100%;
      margin: 0;
    }
  }
`
