import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const ToggleButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 48px;
  padding: 0 14px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 14px;

  &:hover,
  &[data-open] {
    background: ${theme.editor.surfaceHover};
  }
`

// Below the preview on desktop; a bottom sheet over it on phones, where there is no room to split.
export const Drawer = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 50%;
  overflow-y: auto;
  padding: 8px 12px 12px;
  border-top: 1px solid ${theme.editor.line};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};

  ${mobile} {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 2;
    max-height: 70vh;
    border-radius: ${theme.radius.cardLg} ${theme.radius.cardLg} 0 0;
    padding-bottom: 24px;
    box-shadow: 0 -8px 24px ${theme.colors.overlayStrong};
  }
`

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
`

export const DrawerTitle = styled.span`
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
`

export const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: ${theme.radius.chip};
  background: transparent;
  color: ${theme.colors.white};

  &:hover {
    background: ${theme.editor.surfaceHover};
  }
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;

  ${mobile} {
    grid-template-columns: minmax(0, 1fr);
  }
`

// Every field is a 40px box: label on the left, control on the right, the dropdowns' look.
const fieldBox = `
  height: 40px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.input};
  background: ${theme.editor.bg};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  &[data-select] button[role='combobox'] {
    height: 40px;
    font-size: 15px;
  }
`

export const FieldBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 0 12px;
  ${fieldBox}
`

export const Label = styled.span`
  flex: none;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${theme.editor.label};
`

export const Segmented = styled.div`
  display: flex;
  gap: 4px;
`

export const SegmentButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px 0 7px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.pill};
  background: transparent;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 14px;

  & svg {
    font-size: 16px;
  }

  &[data-selected] {
    border-width: 2px;
    border-color: ${theme.editor.accent};
    background: ${theme.editor.surfaceHover};
  }
`

// Scrolls sideways (no visible bar) when the field is too narrow; the ends fade where more is hidden.
export const Swatches = styled.div`
  display: flex;
  flex: 1 1 auto;
  gap: 4px;
  min-width: 0;
  padding: 2px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /* Right-aligns while there is room; once the row overflows the auto margin collapses to 0 so the
     palette scrolls from its start (justify-content: flex-end would hide the start for good). */
  & > :first-of-type {
    margin-left: auto;
  }

  &[data-fade-start] {
    mask-image: linear-gradient(to right, transparent, ${theme.colors.text} 20px);
  }
  &[data-fade-end] {
    mask-image: linear-gradient(to left, transparent, ${theme.colors.text} 20px);
  }
  &[data-fade-start][data-fade-end] {
    mask-image: linear-gradient(
      to right,
      transparent,
      ${theme.colors.text} 20px,
      ${theme.colors.text} calc(100% - 20px),
      transparent
    );
  }
`

export const Swatch = styled.button`
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid ${theme.colors.glass};
  border-radius: 50%;
  cursor: pointer;

  &[data-selected] {
    border-color: ${theme.colors.white};
    outline: 2px solid ${theme.editor.accent};
  }
`
