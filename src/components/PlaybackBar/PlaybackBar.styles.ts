import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 4px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};

  & button[role='combobox'] {
    min-width: 150px;
    height: 40px;
    border: 0;
    font-size: 14px;
    font-weight: 500;
  }
`

export const CollectionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};

  & svg {
    width: 16px;
    height: 16px;
  }
`

export const StopButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 12px 0 8px;
  border: 0;
  border-radius: ${theme.radius.chip};
  background: transparent;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 14px;

  &:hover {
    background: ${theme.editor.surfaceHover};
  }
`

// ui2 lays its controls out absolutely against the nearest positioned ancestor, sized to it; anchoring
// them here and resetting that placement keeps them inside this box, in the row with the other controls.
export const EmoteControlsWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  height: 48px;
  min-width: 320px;
  padding: 0 5px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.editor.surface};

  & > .MuiBox-root {
    position: static;
    flex: 1;
    width: auto;
    min-width: 0;
    margin: 0;
    padding: 0;
    gap: 5px;
  }

  /* ui2's controls carry their own MUI look; recolor them to the editor's controls. */
  .MuiButtonBase-root {
    width: 50px;
    height: 36px;
    min-width: 50px;
    margin: 0;
    border: 1px solid ${theme.editor.line};
    border-radius: ${theme.radius.chip};
    background: ${theme.editor.bg} !important;
    color: ${theme.colors.white};
    opacity: 1;

    &:hover {
      background: ${theme.editor.surfaceHover} !important;
    }
    .MuiSvgIcon-root {
      margin: 0;
      fill: ${theme.colors.white};
    }
  }

  input[type='number'] {
    width: 50px;
    height: 36px;
    padding: 0;
    border: 1px solid ${theme.editor.line};
    border-radius: ${theme.radius.chip};
    background: ${theme.editor.bg};
    color: ${theme.colors.white};
    font: inherit;
    font-size: 14px;
    text-align: center;
    appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      appearance: none;
      margin: 0;
    }
    &:focus-visible {
      outline: 0;
      border-color: ${theme.editor.label};
    }
  }

  input[type='range'] {
    &::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: ${theme.radius.chip};
      background: ${theme.editor.surfaceHover};
    }
    &::-moz-range-track {
      height: 6px;
      border-radius: ${theme.radius.chip};
      background: ${theme.editor.surfaceHover};
    }
    &::-webkit-slider-thumb {
      width: 16px;
      height: 16px;
      margin-top: -5px;
      padding: 0;
      border-radius: 50%;
      background-color: ${theme.editor.accent};
    }
    &::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: ${theme.editor.accent};
    }
  }
`
