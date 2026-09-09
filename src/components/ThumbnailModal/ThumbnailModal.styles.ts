import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const PreviewArea = styled.div`
  position: relative;
  width: 500px;
  height: 350px;
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
      width: 32px;
      height: 32px;
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
    padding-left: 8px;

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

/* The capture is square while the preview is wide: outline the square that ends up in the thumbnail.
   Click-through so drag/zoom still reach the preview iframe. */
export const Frame = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  border: 2px dashed ${theme.colors.overlay};
  pointer-events: none;
`

/* ui2's emote controls carry their own MUI look and pin to the bottom of their parent; here they sit
   below the preview in the app palette. Doubled selector outranks ui2's equally-specific classes. */
export const EmoteBar = styled.div`
  width: 100%;

  &[data-ready='false'] {
    display: none;
  }

  && .emote-controls {
    position: static;
    align-items: center;
    margin: 0;
    padding: 0;
    gap: 12px;
  }

  && .MuiButtonBase-root {
    width: 56px;
    height: 46px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border-radius: ${theme.radius.btn};
    background: ${theme.colors.overlay} !important;
    color: ${theme.colors.white};
    opacity: 1;

    &:hover {
      background: ${theme.colors.overlayHover} !important;
    }
    .MuiSvgIcon-root {
      margin: 0;
      fill: ${theme.colors.white};
    }
  }

  && input[type='range'] {
    height: 46px;
    margin: 0;
    cursor: pointer;

    &::-webkit-slider-runnable-track {
      width: auto;
      height: 6px;
      border-radius: ${theme.radius.pill};
      background: ${theme.colors.glass};
    }
    &::-webkit-slider-thumb {
      width: 18px;
      height: 18px;
      margin-top: -6px;
      padding: 0;
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
      border-radius: 50%;
      background: ${theme.colors.white};
      box-shadow: 0 2px 6px ${theme.colors.overlay};
    }
    &:focus-visible {
      outline: 2px solid ${theme.colors.glassLine};
      outline-offset: 2px;
    }
  }

  && input[type='number'] {
    height: 46px;
    border: 1px solid ${theme.colors.glassLine};
    border-radius: ${theme.radius.btnSm};
    background: ${theme.colors.glassFaint};
    font: inherit;
    font-size: 14px;
    appearance: textfield;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      appearance: none;
    }
    &:focus-visible {
      outline: 2px solid ${theme.colors.glassLine};
      outline-offset: 2px;
    }
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

export const Spinner = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  margin: -16px 0 0 -16px;
  border-radius: 50%;
  border: 3px solid ${theme.colors.glass};
  border-top-color: ${theme.colors.text};
  animation: spin 0.8s linear infinite;
`

export const LoadError = styled.p`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 24px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.errStrong};
`
