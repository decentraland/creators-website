import styled from '@emotion/styled'
import { Spinner } from '~/styles/shared'
import { theme } from '~/styles/theme'

export { Spinner }

const card = theme.media.noActions

// Shared by the header and the rows so they stay aligned: every track depends on the row width alone, never on
// its content, so each row resolves the same widths. The name gets twice the room of the other fields; the pill
// columns keep a floor so their nowrap pills never spill into the next cell.
const FIELD = 'minmax(0, 1fr)'
const SALE_STATUS = 'minmax(124px, 1fr)'
const STATUS = 'minmax(136px, 1fr)'
const columns = ({ playMode = false, market = false, status = false } = {}) =>
  `grid-template-columns: 74px minmax(0, 1.5fr) ${[
    FIELD,
    FIELD,
    ...(playMode ? [FIELD] : []),
    FIELD,
    ...(market ? [FIELD, FIELD, SALE_STATUS] : []),
    ...(status ? [STATUS] : [])
  ].join(' ')} minmax(56px, auto);`

export const itemListColumns = `
  display: grid;
  ${columns()}
  align-items: center;
  gap: 16px;

  &[data-with-play-mode] {
    ${columns({ playMode: true })}
  }
  &[data-with-market] {
    ${columns({ market: true })}
  }
  &[data-with-play-mode][data-with-market] {
    ${columns({ playMode: true, market: true })}
  }
  &[data-with-status] {
    ${columns({ status: true })}
  }
  &[data-with-play-mode][data-with-status] {
    ${columns({ playMode: true, status: true })}
  }
  &[data-with-market][data-with-status] {
    ${columns({ market: true, status: true })}
  }
  &[data-with-play-mode][data-with-market][data-with-status] {
    ${columns({ playMode: true, market: true, status: true })}
  }
`

export const Row = styled.article`
  ${itemListColumns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};

  /* Inset shadows, not borders, so flagged rows stay aligned with the header's columns. */
  &[data-validation='errors'] {
    box-shadow: inset 0 0 0 1px ${theme.colors.errLight};
    background:
      linear-gradient(90deg, ${theme.colors.errorOverlay}, ${theme.colors.errOverlay}), ${theme.colors.overlay};
  }

  &[data-validation='warnings'] {
    box-shadow: inset 3px 0 0 ${theme.colors.amber};
  }

  ${card} {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }
`

// Transparent in the table so name and fields stay grid children; a wrapping row beside the thumbnail in the card.
export const Content = styled.div`
  display: contents;

  ${card} {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    min-width: 0;
    row-gap: 6px;
    column-gap: 16px;
  }
`

export const Thumb = styled.div`
  flex: none;
  width: 74px;
  height: 74px;
  border-radius: 6px;
  overflow: hidden;

  ${card} {
    width: 62px;
    height: 62px;
  }
`

export const Name = styled.span`
  min-width: 0;
  max-width: 100%;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  color: ${theme.colors.softWhite};
  display: inline-flex;
  align-items: center;

  /* On desktop the rename button's padding spaces the badge; the card shows plain text. */
  ${card} {
    gap: 8px;
  }
`

export const NameText = styled.span`
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

// A pencil that takes no room until hovered or focused, inside a glass pill (the price shortcut's look).
const editPill = `
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: none;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease;

  & > svg {
    flex: none;
    width: 0;
    font-size: 18px;
    opacity: 0;
    transition:
      width 0.15s ease,
      opacity 0.15s ease;
  }
  &:hover,
  &:focus-visible {
    background: ${theme.colors.glassFaint};
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
  &:hover > svg,
  &:focus-visible > svg {
    width: 18px;
    opacity: 1;
  }
`

// The whole name is the edit trigger; it keeps the text's ellipsis and sits flush with the column.
export const NameButton = styled.button`
  ${editPill};
  min-width: 0;
  max-width: calc(100% + 8px);
  margin-left: -8px;
  padding: 0 4px 0 8px;
  text-align: left;
`

export const NameEditor = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: calc(100% + 8px);
  margin-left: -8px;
`

export const NameInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 4px 8px;
  border: 1px solid ${theme.colors.softWhite};
  border-radius: ${theme.radius.chip};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.softWhite};
  font-size: 14px;
  font-weight: 700;
  outline: none;

  &[data-invalid] {
    border-color: ${theme.colors.errLight};
  }
  &:disabled {
    opacity: 0.6;
  }
`

export const EditorButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  margin-left: 8px;
  padding: 0;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: none;
  color: ${theme.colors.white};
  cursor: pointer;

  & svg {
    font-size: 20px;
  }
  &[data-variant='cancel'] {
    background: ${theme.colors.overlay};
    border: 1px solid ${theme.colors.muted1};

    &:hover {
      border-color: ${theme.colors.muted2};
    }
  }
  &[data-variant='save'] {
    background: ${theme.colors.dclRed};

    &:hover {
      background: ${theme.colors.dclRedHover};
    }
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
`

export const ThumbButton = styled.button`
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: -2px;
  }
`

export const ThumbBadge = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: ${theme.colors.white};
  color: ${theme.colors.muted};
  opacity: 0;
  transition: opacity 0.15s ease;

  & svg {
    font-size: 16px;
  }
  button:hover > &,
  button:focus-visible > & {
    opacity: 1;
  }
`

// Reads as plain text at rest; a glass pill with a pencil once hovered or focused.
export const PriceButton = styled.button`
  ${editPill};
  padding: 0 10px;
`
export const SmartBadge = styled.span`
  display: inline-flex;
  color: ${theme.colors.softWhite};
  background: ${theme.colors.glassHover};
  border-radius: ${theme.radius.chip};
  padding: 1px;

  svg {
    width: 18px;
    height: 18px;
  }
`

export const ValidationChip = styled.button`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: 8px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.amber};

  &[data-status='errors'] {
    background: ${theme.colors.errorOverlay};
    color: ${theme.colors.errLight};
  }

  svg {
    width: 20px;
    height: 20px;
  }
`

export const Cell = styled.div`
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
  display: flex;
  justify-content: center;

  ${card} {
    justify-content: flex-start;

    /* The table grid needs the "—" to keep columns aligned; the wrapped card does not. */
    &[data-empty] {
      display: none;
    }
  }
`

export const Amount = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
`

export const ActionsCell = styled.div`
  display: flex;
  justify-content: flex-end;

  ${card} {
    flex: none;
    margin-left: auto;
  }
`
