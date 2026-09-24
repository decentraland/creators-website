import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const { colors, gradients, media } = theme

const mobile = media.maxWidth('mobile')

export const Hero = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  /* Fills most of the first viewport below the fixed navbar and the sticky sub-nav. */
  min-height: calc(90vh - var(--nav-h) - var(--sub-nav-h));
  padding: 48px 32px;
  overflow: hidden;

  ${mobile} {
    padding: 40px 16px;
  }
`

export const Background = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;

  & video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
`

export const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 740px;
  text-align: center;
`

export const Title = styled.h1`
  margin: 0 0 44px;
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -1.28px;
  line-height: normal;
  color: ${colors.white};

  & span {
    background: ${gradients.ember};
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  ${mobile} {
    margin-bottom: 32px;
    font-size: 48px;
    letter-spacing: -0.8px;
  }
`

export const Subtitle = styled.p`
  margin: 0 0 68px;
  font-size: 24px;
  font-weight: 500;
  line-height: 32px;
  color: ${colors.white};

  ${mobile} {
    margin-bottom: 64px;
    font-size: 20px;
    font-weight: 400;
    line-height: 30px;
  }
`

export const ScrollButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 40px 0 32px;
  border: 0;
  background: none;
  color: ${colors.muted2};

  & svg {
    font-size: 32px;
  }
  &:hover svg {
    animation: overview-bounce 1s linear infinite;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: -4px;
  }

  @keyframes overview-bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    &:hover svg {
      animation: none;
    }
  }
`
