import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Below the actions breakpoint the table row reshapes into a card; see theme.media.noActions.
const card = theme.media.noActions

// Shared column template so the header and the rows stay aligned: thumbnail, then equal columns
// (name, body shape, category, [play mode], rarity, [price, sales, sale status]), then actions. The header's "Item"
// spans the first two. Play Mode is only laid out when the list being shown has emotes; Price and
// Sales and Sale Status only once the collection has been published.
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

  ${theme.media.noActions} {
    display: none;
  }
`
