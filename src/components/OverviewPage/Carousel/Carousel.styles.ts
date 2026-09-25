import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { hitArea } from '../OverviewPage.styles'

const { colors, media, radius } = theme

const tablet = media.maxWidth('tablet')

export const Wrapper = styled.div`
  position: relative;
  width: 100%;
  padding-top: 24px;
  overflow: hidden;

  &:hover [data-direction] {
    opacity: 1;
  }
`

export const Track = styled.div`
  display: flex;
  will-change: transform;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`

export const Slide = styled.div`
  flex-shrink: 0;
  border-radius: ${radius.cardLg};
  overflow: hidden;
  opacity: 0;
  transform: scale(0.8);
  transition:
    opacity 0.4s ease,
    box-shadow 0.4s ease,
    transform 0.4s ease;

  &[data-position='active'] {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 2px 8px 8px ${colors.glassGlow};
  }
  &[data-position='prev'] {
    opacity: 0.7;
    mask-image: linear-gradient(to right, transparent 0%, black 50%);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 50%);
  }
  &[data-position='next'] {
    opacity: 0.7;
    mask-image: linear-gradient(to right, black 50%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, black 50%, transparent 100%);
  }

  ${tablet} {
    opacity: 1;
    transform: scale(1);

    &[data-position='prev'],
    &[data-position='next'] {
      mask-image: none;
      -webkit-mask-image: none;
    }
    &[data-position='active'] {
      box-shadow: none;
    }
    & > * {
      width: 100%;
      min-width: 0;
    }
  }
`

export const Dots = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 24px;
`

export const Dot = styled.button`
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${colors.glassStrong};
  cursor: pointer;
  transition: background-color 0.3s ease;
  ${hitArea(18, 4)}

  &[data-active] {
    background: ${colors.white};
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
`

export const Arrow = styled.button`
  position: absolute;
  top: 45%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid ${colors.glassLine};
  background: ${colors.overlay};
  color: ${colors.white};
  font-size: 24px;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: ${colors.overlayStrong};
  }
  &:focus-visible {
    opacity: 1;
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
  &[data-direction='prev'] {
    left: 24px;
  }
  &[data-direction='next'] {
    right: 24px;
  }

  ${tablet} {
    display: none;
  }
`
