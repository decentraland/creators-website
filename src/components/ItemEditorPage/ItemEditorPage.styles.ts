import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Workspace = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${theme.editor.bg};
  color: ${theme.colors.white};
`

export const Columns = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;

  /* While a handle is dragged the iframe must not eat the pointer, or the drag ends when crossing it. */
  &:has([data-resize-handle-state='drag']) iframe {
    pointer-events: none;
  }
`

// A hairline marks where a panel ends; it thickens slightly in accent while resizing.
// The collection picker reuses the sidebar's shell at its expanded width.
export const PickerColumn = styled.div`
  flex: none;
  width: 314px;
  height: 100%;
  border-right: 1px solid ${theme.editor.line};
`

export const Handle = styled.div`
  position: relative;
  flex: none;
  width: 5px;
  height: 100%;
  transition: background 120ms;

  &::after {
    content: '';
    position: absolute;
    inset: 0 2px;
    background: ${theme.editor.line};
    transition: background 120ms;
  }

  /* Plain :hover rather than the library's hover state: that one is tracked from document pointer
     events, which the preview iframe swallows, so it sticks when the pointer moves onto the preview.
     The drag state is stamped on the wrapper element, the parent of this div. */
  :hover > &::after,
  [data-resize-handle-state='drag'] > &::after,
  [data-resize-handle-active] > &::after {
    inset: 0 1.5px;
    background: ${theme.editor.accent};
  }
`

export const PanelBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 8px 10px 0 8px;
  overflow-y: auto;
  background: ${theme.editor.bg};
`

export const CenterPanel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
`

export const PreviewArea = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`

export const PreviewEmpty = styled.div`
  display: grid;
  place-items: center;
  height: 100%;
  padding: 24px;
  text-align: center;
  color: ${theme.editor.label};
`

export const StatePanel = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex: 1;
  padding: 48px 24px;
  text-align: center;
`

export const StateTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: ${theme.colors.white};
`

export const StateText = styled.p`
  margin: 0;
  max-width: 520px;
  font-size: 15px;
  line-height: 1.5;
  color: ${theme.editor.label};
`

export const Section = styled.section`
  border-radius: 6px;
  background: ${theme.editor.surface};

  &:last-of-type {
    margin-bottom: 12px;
  }

  & [role='combobox'] {
    height: 46px;
  }
`

export const SectionHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 46px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-align: left;

  & svg {
    transition: transform 120ms;
  }

  &[aria-expanded='false'] svg[data-chevron] {
    transform: rotate(-90deg);
  }

  &[data-icon-only] {
    justify-content: center;
    padding: 0;
  }
`

export const SectionTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SectionIcon = styled.span`
  display: inline-flex;
  flex: none;
  color: ${theme.editor.label};

  & svg {
    width: 16px;
    height: 16px;
  }

  [data-collapsed] & svg {
    width: 24px;
    height: 24px;
  }

  [data-icon-only] > & {
    margin: 0 auto;
  }
`

export const SectionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 12px 12px;
  overflow: auto;

  [data-collapsed] & {
    padding: 0 3px 12px;
  }
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: ${theme.editor.label};
`

export const FieldLabel = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 16px;
  padding-right: 2px;
`

export const LabelText = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 16px;

  & svg {
    display: block;
  }
`

// Same field format as the app's inputs and the selects next to them.
const fieldControl = `
  width: 100%;
  padding: 0 12px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.input};
  background: ${theme.editor.bg};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 16px;
  line-height: 24px;

  &::placeholder {
    color: ${theme.editor.label};
  }

  &:focus {
    outline: 0;
    border-color: ${theme.editor.label};
  }

  &:disabled {
    opacity: 0.6;
  }

  &[data-invalid] {
    border-color: ${theme.colors.errLight};
  }
`

export const TextInput = styled.input`
  height: 46px;
  ${fieldControl}
`

export const TextArea = styled.textarea`
  min-height: 88px;
  padding-top: 15px;
  padding-bottom: 15px;
  resize: none;
  ${fieldControl}
`

export const CharCount = styled.span`
  font-size: 11px;
  color: ${theme.editor.label};
  margin-left: auto;
`

export const ErrorText = styled.span`
  font-size: 12px;
  color: ${theme.colors.errLight};
`

export const Toggle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  font-size: 14px;
  color: ${theme.colors.white};

  & > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
`

export const Segmented = styled.div`
  display: flex;
  gap: 8px;
`

export const SegmentButton = styled.button`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  padding: 0 12px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.input};
  background: ${theme.editor.bg};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 16px;
  line-height: 24px;

  &:hover:not(:disabled) {
    border-color: ${theme.editor.label};
  }

  &[data-selected]:not(:disabled) {
    border-color: ${theme.editor.accent};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`

export const Footer = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding: 12px 0;
  background: ${theme.editor.bg};
  border-top: 1px solid ${theme.editor.line};

  & > button[data-size='sm'] {
    min-width: 100px;
  }
`

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 4px;
`

export const PanelTitle = styled.h2`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const PanelTitleRow = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const HeaderBadge = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  padding: 1px;
  border-radius: ${theme.radius.chip};
  background: ${theme.colors.glassHover};
  color: ${theme.colors.softWhite};

  svg {
    width: 18px;
    height: 18px;
  }
`

export const DetailsRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

export const ThumbButton = styled.button`
  position: relative;
  flex: none;
  width: 96px;
  height: 96px;
  padding: 0;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: transparent;
  overflow: hidden;
  cursor: pointer;

  & [data-testid='item-thumbnail'] {
    width: 100%;
    height: 100%;
  }

  &:disabled {
    cursor: default;
  }
`

export const ThumbOverlay = styled.span`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: ${theme.colors.overlay};
  color: ${theme.colors.white};
  opacity: 0;
  transition: opacity 120ms;

  button:hover > &,
  button:focus-visible > & {
    opacity: 1;
  }
`

export const Metrics = styled.ul`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Metric = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: ${theme.colors.white};

  & > svg {
    flex: none;
    width: 16px;
    height: 16px;
    color: ${theme.editor.label};
  }
`

export const VideoPane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid ${theme.editor.line};
  font-size: 13px;
  color: ${theme.editor.label};
`

export const VideoPoster = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: ${theme.editor.bg};
`

export const PosterPlaceholder = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.editor.bg};
  color: ${theme.editor.label};
  pointer-events: none;

  & svg {
    width: 28px;
    height: 28px;
  }
`

export const PlayBadge = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${theme.colors.overlayStrong};
  color: ${theme.colors.white};
  transform: translate(-50%, -50%);
  pointer-events: none;

  button:hover > &,
  button:focus-visible > & {
    opacity: 0;
  }
`

export const MetricText = styled.span`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Warning = styled.div`
  display: flex;
  gap: 8px;
  padding: 10px;
  border-radius: ${theme.radius.chip};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 13px;
  line-height: 1.4;

  & svg {
    flex: none;
  }
`

export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;

  &:empty {
    display: none;
  }
`

export const TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding: 0 4px 0 10px;
  border-radius: ${theme.radius.pill};
  background: ${theme.editor.surfaceHover};
  color: ${theme.colors.white};
  font-size: 13px;

  & button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
  }

  & button:disabled {
    display: none;
  }
`

export const ReadOnlyNote = styled.p`
  margin: 0;
  padding: 8px 12px;
  border-radius: ${theme.radius.chip};
  background: ${theme.editor.surface};
  font-size: 13px;
  color: ${theme.editor.label};
`

export const SectionNote = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: ${theme.editor.label};

  strong {
    color: ${theme.colors.white};
    font-weight: 600;
  }
`

export const ReviewBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 0 12px;
  border-bottom: 1px solid ${theme.editor.line};
  background: ${theme.editor.surface};
`

export const MobileWorkspace = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${theme.editor.bg};
  color: ${theme.colors.white};
`

export const MobilePreviewArea = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`

export const MobileHint = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${theme.editor.surface};
  font-size: 13px;
  color: ${theme.colors.white};

  & > span {
    flex: 1;
  }

  & button {
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: inherit;
  }
`

export const Strip = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 12px 12px;
  overflow-x: auto;
  background: ${theme.editor.bg};
`

export const StripItem = styled.button`
  position: relative;
  flex: none;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: ${theme.radius.btnSm};
  background: transparent;
  overflow: hidden;

  & [data-testid='item-thumbnail'] {
    width: 100%;
    height: 100%;
  }

  &[data-selected] {
    border-color: ${theme.editor.accent};
  }

  &[data-dressed]::after {
    content: '';
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${theme.colors.ok};
  }

  &[data-unavailable] {
    opacity: 0.4;
  }
`
