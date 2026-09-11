import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const card = theme.media.noActions

// Shared by the header and the rows so they stay aligned; the header's "Item" spans the first two columns.
const columns = (count: number) => `grid-template-columns: 74px repeat(${count}, minmax(0, 1fr)) minmax(56px, auto);`

export const itemListColumns = `
  display: grid;
  ${columns(4)}
  align-items: center;
  gap: 16px;

  &[data-with-play-mode] {
    ${columns(5)}
  }
  &[data-with-market] {
    ${columns(7)}
  }
  &[data-with-play-mode][data-with-market] {
    ${columns(8)}
  }
`

export const Row = styled.article`
  ${itemListColumns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};

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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const SmartBadge = styled.span`
  display: inline-flex;
  vertical-align: -3px;
  margin-right: 4px;
  color: ${theme.colors.amber};

  svg {
    width: 16px;
    height: 16px;
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
