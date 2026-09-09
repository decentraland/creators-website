import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Deeper purple than the modal surface, used for sidebar cards and the preview panel.
const wellColor = 'rgba(0, 0, 0, 0.25)'

export const Layout = styled.div`
  display: flex;
  width: 100%;
  height: min(750px, 90vh); /* limit height to avoid overflowing the viewport on small screens */
  overflow: hidden;

  &[data-uploading] {
    pointer-events: none;
    opacity: 0.7;
  }
`

export const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 290px;
  height: 100%;
  flex-shrink: 0;
  padding: 16px;
  border-right: 1px solid ${theme.colors.gray4};
  overflow: auto;

  ${theme.media.maxWidth('xl')} {
    width: 220px;
  }
`

export const DraftCard = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 2px solid transparent;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
  color: ${theme.colors.white};
  text-align: left;
  cursor: pointer;

  /* 3px outer gradient ring: a masked pseudo-element, since the card fill is translucent and a
     border-box gradient would bleed through it. */
  &[data-selected] {
    background: ${theme.colors.overlayStrong};
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);

    &::before {
      content: '';
      position: absolute;
      inset: -3px;
      padding: 3px;
      border-radius: calc(${theme.radius.card} + 3px);
      background: ${theme.gradients.cerise};
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      mask-composite: exclude;
      pointer-events: none;
    }
  }
  &[data-failed] {
    border-color: ${theme.colors.errStrong};
  }
`

export const DraftThumbWrap = styled.span`
  position: relative;
  width: 78px;
  height: 78px;
  flex-shrink: 0;
  border-radius: ${theme.radius.btnSm};
  overflow: hidden;

  ${theme.media.maxWidth('xl')} {
    width: 50px;
    height: 50px;
  }
`

export const DraftCheck = styled.span`
  position: absolute;
  top: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: ${theme.radius.chip};
  border: 2px solid ${theme.colors.dclRed};
  background: ${theme.colors.white};
  color: ${theme.colors.white};

  &[data-checked] {
    border-color: ${theme.colors.success};
    background: ${theme.colors.success};
  }

  svg {
    font-size: 14px;
  }
`

export const DraftInfo = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
`

export const DraftName = styled.span`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
`

export const DraftType = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray4};

  svg {
    width: 13px;
    height: 13px;
  }
`

export const DraftError = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  line-height: 1.35;
  color: ${theme.colors.errStrong};

  svg {
    width: 14px;
    height: 14px;
  }
`

export const DeleteButton = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  padding: 4px;
  border-radius: ${theme.radius.pill};
  color: ${theme.colors.gray4};

  &:hover {
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

/* Right-hand column: the form/processing pane plus the actions, so the sidebar spans full height. */
export const Main = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
`

export const Content = styled.section`
  display: flex;
  flex: 1;
  width: 1045px;
  max-width: 100%;
  gap: 24px;
  overflow-y: auto;
  padding: 16px 24px 24px 16px;

  [data-flush] & {
    padding-left: 24px;
  }
`

export const PreviewPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 50%;
  max-width: 450px;
  padding: 24px;
  border-radius: ${theme.radius.banner};
  background: ${wellColor};
  align-self: flex-start;
`

export const ThumbnailBox = styled.button`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 36px;
  overflow: hidden;
  cursor: pointer;

  /* Styled components must not be used as selectors (Vitest); target the data hook instead. */
  &:hover [data-thumb-overlay],
  &:focus-visible [data-thumb-overlay] {
    opacity: 1;
  }
`

export const ThumbnailOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.overlayStrong};
  opacity: 0;
  transition: opacity 0.3s ease;

  svg {
    font-size: 60px;
    color: ${theme.colors.white};
  }
`

export const MetricsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
`

export const MetricPill = styled.span`
  height: 40px;
  min-width: 120px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.softWhite};
  font-size: 14px;

  svg {
    font-size: 18px;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
  }
`

export const WarningsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const WarningCard = styled.div`
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.softWhite};
  font-size: 13px;
  line-height: 1.4;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
    font-size: 16px;
    color: ${theme.colors.amber};
  }
`

export const FormPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-width: 320px;
`

export const FormHeading = styled.h3`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: ${theme.colors.softWhite};
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.softWhite};
`

export const FieldRow = styled.div`
  display: flex;
  gap: 16px;

  > * {
    flex: 1;
    min-width: 0;
  }
`

export const FieldLabelRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  svg {
    font-size: 15px;
    color: ${theme.colors.gray4};
  }
`

export const TextInputBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btn};
  background: transparent;

  &:focus-within {
    border-color: ${theme.colors.white};
  }
  &[data-invalid] {
    border-color: ${theme.colors.errStrong};
  }

  & input {
    flex: 1;
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: ${theme.colors.white};
    font: inherit;
    font-size: 15px;
    outline: 0;
  }
  & input::placeholder {
    color: ${theme.colors.gray4};
  }
`

export const CharCount = styled.span`
  flex: none;
  font-size: 14px;
  font-weight: 400;
  color: ${theme.colors.media};
`

// Native selects ignore padding around the browser-drawn chevron, so draw our own and inset it 12px.
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fcfcfc'%3E%3Cpath d='M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z'/%3E%3C/svg%3E")`

export const Select = styled.select`
  height: 46px;
  padding: 0 44px 0 14px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btn};
  background: transparent ${chevron} no-repeat right 12px center / 20px 20px;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 15px;
  outline: 0;
  cursor: pointer;
  appearance: none;

  &:focus {
    border-color: ${theme.colors.white};
  }

  option {
    color: ${theme.colors.text};
    background: ${theme.colors.white};
  }
`

export const Segmented = styled.div`
  display: flex;
  gap: 12px;
`

export const SegmentButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px 0 12px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.gray4};
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &[data-selected] {
    border-width: 2px;
    border-color: ${theme.colors.white};
    color: ${theme.colors.white};
    font-weight: 600;
  }

  &:hover {
    background: ${theme.colors.glassFaint};
  }

  svg {
    width: 20px;
    height: 20px;
    font-size: 17px;
  }
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.errStrong};
`

export const Footer = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid ${theme.colors.gray4};

  [data-flush] & {
    padding: 24px;
  }

  ${theme.media.maxWidth('xl')} {
    button {
      min-width: 0;
    }
  }
`

export const FooterRight = styled.div`
  display: flex;
  gap: 16px;
`

export const ProcessingPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  color: ${theme.colors.softWhite};
  font-size: 16px;
  text-align: center;
  flex: 1;
  width: 1045px;
  max-width: 100%;
`

export const ProcessingSpinner = styled.span`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid ${theme.colors.glassFaint};
  border-top-color: ${theme.colors.dclRed};
  animation: spin 0.8s linear infinite;
`

/* Hosts the metrics/screenshot WearablePreview iframe without showing it. */
export const HiddenPreview = styled.div`
  position: fixed;
  width: 1024px;
  height: 1024px;
  left: -10000px;
  top: 0;
  pointer-events: none;
  opacity: 0;
`
