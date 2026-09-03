import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const previewSize = 'min(700px, calc(100vh - 260px))'

export const PreviewArea = styled.div`
  position: relative;
  width: ${previewSize};
  max-width: 100%;
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: ${theme.radius.cardLg};
  background: ${theme.colors.media};
  overflow: hidden;

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  /* ui2's controls carry their own MUI look; recolor them to the app palette. */
  .zoom-controls {
    top: 16px;
    right: 16px;
    gap: 2px;

    .MuiButtonBase-root {
      width: 36px;
      height: 36px;
      background-color: ${theme.colors.overlayStrong} !important;
      color: ${theme.colors.white};

      &:first-of-type {
        border-radius: ${theme.radius.btnSm} ${theme.radius.btnSm} 0 0;
      }
      &:last-of-type {
        border-radius: 0 0 ${theme.radius.btnSm} ${theme.radius.btnSm};
      }
      &:hover {
        background-color: ${theme.colors.overlayHover} !important;
      }
      .MuiSvgIcon-root {
        fill: ${theme.colors.white};
      }
    }
  }

  .translation-controls {
    padding-left: 16px;

    .MuiSvgIcon-root {
      fill: ${theme.colors.muted};
    }
    .MuiSlider-rail,
    .MuiSlider-track {
      background-color: ${theme.colors.overlayLight};
    }
    .MuiSlider-thumb {
      background-color: ${theme.colors.text};
      box-shadow: none;
    }
  }
`

/* ui2 pins the emote controls to the bottom of their parent; here they sit below the preview. */
export const EmoteBar = styled.div`
  width: ${previewSize};
  max-width: 100%;
  margin: 0 auto;

  > * {
    position: static;
    align-items: center;
    margin: 0;
    padding: 0;
    gap: 12px;
  }
`

export const Scrubber = styled.input`
  flex: 1;
  height: 46px;
  margin: 0;
  background: none;
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: ${theme.radius.pill};
    background: ${theme.colors.glass};
  }
  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    margin-top: -6px;
    border-radius: 50%;
    background: ${theme.colors.white};
    box-shadow: 0 2px 6px ${theme.colors.overlay};
  }
  &::-moz-range-track {
    height: 6px;
    border-radius: ${theme.radius.pill};
    background: ${theme.colors.glass};
  }
  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: 50%;
    background: ${theme.colors.white};
    box-shadow: 0 2px 6px ${theme.colors.overlay};
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.glassLine};
    outline-offset: 2px;
  }
`

export const FrameInput = styled.input`
  width: 56px;
  height: 46px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 14px;
  text-align: center;
  appearance: textfield;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    appearance: none;
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.glassLine};
    outline-offset: 2px;
  }
`

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 16px;
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.errStrong};
`
