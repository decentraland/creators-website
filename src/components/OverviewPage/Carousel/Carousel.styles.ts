import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const { colors, media } = theme

const mobile = media.maxWidth('mobile')

export const Wrapper = styled.div`
  position: relative;
  width: 100%;
  /* 100vw rather than 100%: the slide width feeds the track's own padding, which cannot reference itself. */
  --slide: min(var(--slide-w), calc(100vw - 32px));

  ${mobile} {
    --slide: calc(100vw - 32px);
  }
`

export const Track = styled.div`
  display: flex;
  gap: 24px;
  /* Centers the active slide: the padding is what lets the first and last slide snap to the middle. */
  padding: 16px calc((100% - var(--slide)) / 2);
  scroll-padding: 0 calc((100% - var(--slide)) / 2);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  ${mobile} {
    gap: 16px;
  }
`

export const Slide = styled.div`
  flex: 0 0 var(--slide);
  min-width: 0;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  opacity: 0.55;
  transition: opacity 0.4s ease;

  &[data-active] {
    opacity: 1;
  }

  ${mobile} {
    opacity: 1;
  }
`

export const Arrow = styled.button`
  position: absolute;
  top: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid ${colors.glassLine};
  background: ${colors.overlay};
  color: ${colors.white};
  transform: translateY(-50%);
  transition: background 0.15s ease;

  &:hover {
    background: ${colors.overlayStrong};
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
  &[data-direction='prev'] {
    left: 12px;
  }
  &[data-direction='next'] {
    right: 12px;
  }

  ${mobile} {
    /* Phones swipe; the arrows would sit on top of the card. */
    display: none;
  }
`

export const Dots = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 8px;
`

export const Dot = styled.button`
  /* 8px visual dot inside a 44px touch target. */
  position: relative;
  width: 24px;
  height: 44px;
  padding: 0;
  border: 0;
  background: none;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${colors.glass};
    transform: translate(-50%, -50%);
    transition: background 0.3s ease;
  }
  &[data-active]::before {
    background: ${colors.white};
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: -8px;
    border-radius: 50%;
  }
`
