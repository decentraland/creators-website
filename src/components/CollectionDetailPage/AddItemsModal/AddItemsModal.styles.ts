import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

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
  align-items: flex-start;
  width: 1045px;
  max-width: 100%;
  gap: 24px;
  overflow-y: auto;
  padding: 16px 24px 24px 16px;

  [data-flush] & {
    padding-left: 16px;
  }

  ${theme.media.maxWidth('mobile')} {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }
`

export const PreviewPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 476px;
  max-width: 50%;
  flex-shrink: 0;
  padding: 24px;
  border-radius: ${theme.radius.banner};
  background: ${theme.colors.overlayLight};

  ${theme.media.maxWidth('mobile')} {
    width: 100%;
    max-width: none;
  }
`

export const ThumbnailWrap = styled.div`
  position: relative;
`

export const ThumbnailBadge = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${theme.colors.overlayStrong};
  color: ${theme.colors.white};
  cursor: default;

  svg {
    width: 22px;
    height: 22px;
  }
`

export const ThumbnailBox = styled.button`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: ${theme.radius.banner};
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

/* Wearable pills share the row equally; the emote set (four pills) hugs its content instead. */
export const MetricsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;

  > * {
    flex: 1;
  }
  &[data-compact] > * {
    gap: 4px;
    font-size: 12px;
    color: ${theme.colors.gray4};

    svg {
      width: 16px;
      height: 16px;
    }
  }
`

export const MetricPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.softWhite};
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;

  svg {
    width: 24px;
    height: 24px;
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
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 12px;
  line-height: 1.334;

  svg {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: ${theme.colors.amber};
  }
`

export const VideoPoster = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 132px;
  min-height: 84px;
  padding: 0;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.text};
  overflow: hidden;
  cursor: pointer;

  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  &:hover [data-video-overlay],
  &:focus-visible [data-video-overlay] {
    opacity: 1;
  }

  ${theme.media.maxWidth('mobile')} {
    width: 96px;
  }
`

export const VideoPosterOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.overlayStrong};
  opacity: 0;
  transition: opacity 0.3s ease;

  svg {
    width: 32px;
    height: 32px;
    color: ${theme.colors.white};
  }
`

export const VideoPlay = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${theme.colors.overlayStrong};
  transition: background 0.2s ease;

  svg {
    width: 24px;
    height: 24px;
    color: ${theme.colors.white};
  }
`

export const VideoInfo = styled.span`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
`

export const VideoName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.softWhite};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const VideoMeta = styled.span`
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const FormPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex: 1;
  min-width: 0;
`

export const FormHeading = styled.h3`
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  line-height: 1.334;
  color: ${theme.colors.softWhite};
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.57;
  color: ${theme.colors.softWhite};

  &[data-hinted] {
    gap: 12px;
  }
`

export const FieldLabel = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const FieldHint = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  line-height: normal;
  color: ${theme.colors.muted2};

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
`

export const FieldRow = styled.div`
  display: flex;
  gap: 12px;

  > * {
    flex: 1;
    min-width: 0;
  }

  ${theme.media.maxWidth('mobile')} {
    flex-wrap: wrap;

    > * {
      flex-basis: 100%;
    }
  }
`

export const FieldLabelRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  svg {
    font-size: 12px;
    color: ${theme.colors.softWhite};
  }
`

export const TextInputBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 12px;
  border: 1px solid ${theme.colors.muted2};
  border-radius: ${theme.radius.input};
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
    color: ${theme.colors.softWhite};
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    outline: 0;
  }
  & input::placeholder {
    color: ${theme.colors.muted2};
    font-weight: 600;
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
  height: 56px;
  padding: 0 44px 0 12px;
  border: 1px solid ${theme.colors.muted2};
  border-radius: ${theme.radius.input};
  background: transparent ${chevron} no-repeat right 12px center / 24px 24px;
  color: ${theme.colors.softWhite};
  font: inherit;
  font-size: 16px;
  font-weight: 600;
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
  flex-wrap: wrap;
  gap: 12px;

  /* Joined variant (Yes/No): one pill, shared inner borders. */
  &[data-joined] {
    gap: 0;

    > * {
      padding: 0 12px;
      border-radius: 0;
    }
    > * + * {
      margin-left: -1px;
    }
    > :first-of-type {
      border-radius: ${theme.radius.input} 0 0 ${theme.radius.input};
    }
    > :last-of-type {
      border-radius: 0 ${theme.radius.input} ${theme.radius.input} 0;
    }
  }
`

export const SegmentButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px 0 12px;
  border: 1px solid ${theme.colors.muted2};
  border-radius: ${theme.radius.input};
  background: none;
  color: ${theme.colors.muted2};
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  cursor: pointer;

  /* The 2px selected stroke is border + inset shadow so the box never grows. */
  &[data-selected] {
    z-index: 1;
    border-color: ${theme.colors.white};
    box-shadow: inset 0 0 0 1px ${theme.colors.white};
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
  }

  &:hover:not([aria-disabled]) {
    background: ${theme.colors.glassFaint};
  }

  &[aria-disabled] {
    cursor: default;
  }
  &[aria-disabled]:not([data-selected]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
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
