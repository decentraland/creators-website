import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import gridBackground from '~/assets/overview/connect-grid.webp'
import { SectionTitle } from '../OverviewPage.styles'

const { colors, font, media } = theme

const tablet = media.maxWidth('tablet')

export const Section = styled.section`
  position: relative;
  width: 100%;
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
    background: linear-gradient(90deg, ${colors.inkFade} 0%, transparent 100%);
  }
  &::after {
    right: 0;
    background: linear-gradient(270deg, ${colors.inkFade} 0%, transparent 100%);
  }
`

export const Title = styled(SectionTitle)`
  margin: 56px auto 40px;

  ${tablet} {
    margin: 41px auto 36px;
    padding: 0 20px;
  }
`

export const Card = styled.a`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  padding: 32px 24px;
  border-radius: 20px;
  background: ${colors.softWhite};
  color: ${colors.text};
  cursor: pointer;
  transition: transform 0.3s ease-in-out;

  @media (hover: hover) {
    &:hover {
      transform: scale(1.05);
    }
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${tablet} {
    padding: 24px;
  }
`

export const Quote = styled.p`
  margin: 0;
  font-size: 16px;
  font-weight: 400;
  font-style: italic;
  line-height: 24px;
  letter-spacing: ${font.tracking};

  ${tablet} {
    font-size: 20px;
    line-height: 30px;
    text-align: center;
  }
`

export const Author = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin-top: 16px;

  & img {
    width: 40px;
    min-width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  ${tablet} {
    align-items: center;
    margin-top: 24px;
  }
`

export const AuthorName = styled.span`
  max-width: 100%;
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const Discord = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 56px 0 32px;
  color: ${colors.white};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  /* Keyboard focus gets the same affordance as hover; touch devices (no hover) skip it. */
  @media (hover: hover) {
    &:hover [data-discord-title] {
      text-decoration: underline;
    }
    &:hover [data-discord-icon] img {
      transform: scale(1.1);
    }
  }
  &:focus-visible [data-discord-title] {
    text-decoration: underline;
  }
  &:focus-visible [data-discord-icon] img {
    transform: scale(1.1);
  }

  ${tablet} {
    margin-top: 43px;
  }
`

/* The image stays inline so its line box keeps the descender gap the design was measured with. */
export const DiscordIcon = styled.span`
  display: block;

  & img {
    width: 93px;
    height: 80px;
    margin-top: 23px;
    transition: transform 0.2s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    & img {
      transition: none;
    }
  }

  ${tablet} {
    & img {
      width: 50px;
      margin-top: 0;
    }
  }
`

export const DiscordTitle = styled.span`
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  text-align: center;
  text-shadow: 0 4px 20px ${colors.overlayHover};
  text-underline-offset: 4px;

  ${tablet} {
    font-size: 18px;
  }
`
