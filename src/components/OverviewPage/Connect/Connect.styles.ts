import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import gridBackground from '~/assets/overview/connect-grid.webp'
import { SectionTitle } from '../OverviewPage.styles'

const { colors, media } = theme

const mobile = media.maxWidth('mobile')

export const Section = styled.section`
  position: relative;
  width: 100%;
  padding-bottom: 32px;
  background: url(${gridBackground}) center / cover no-repeat;
  overflow: hidden;

  /* Fades the grid out at the edges so the slides in the wings read as background. */
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: 15%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }
  &::before {
    left: 0;
    background: linear-gradient(90deg, ${colors.overlayStrong} 0%, transparent 100%);
  }
  &::after {
    right: 0;
    background: linear-gradient(270deg, ${colors.overlayStrong} 0%, transparent 100%);
  }
`

export const Title = styled(SectionTitle)`
  margin: 56px auto 24px;
  padding: 0 16px;

  ${mobile} {
    margin: 40px auto 20px;
  }
`

export const Card = styled.a`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 32px 24px;
  border-radius: 20px;
  background: ${colors.softWhite};
  color: ${colors.text};
  transition: transform 0.3s ease-in-out;

  @media (hover: hover) {
    &:hover {
      transform: scale(1.03);
    }
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${mobile} {
    padding: 24px;
  }
`

export const Quote = styled.p`
  margin: 0;
  font-size: 16px;
  font-style: italic;
  line-height: 24px;

  ${mobile} {
    font-size: 18px;
    line-height: 28px;
    text-align: center;
  }
`

export const Author = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;

  & img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  ${mobile} {
    align-items: center;
    margin-top: 24px;
  }
`

export const AuthorName = styled.span`
  font-size: 18px;
  font-weight: 700;
`

export const Discord = styled.a`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: fit-content;
  margin: 40px auto 0;
  padding: 8px 16px;
  color: ${colors.white};

  & img {
    width: 93px;
    height: 80px;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${mobile} {
    margin-top: 32px;

    & img {
      width: 50px;
      height: 43px;
    }
  }
`

export const DiscordTitle = styled.span`
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  text-shadow: 0 4px 20px ${colors.overlayHover};

  ${mobile} {
    font-size: 18px;
  }
`
