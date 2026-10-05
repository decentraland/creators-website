import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const card = theme.media.noActions
const mobile = theme.media.maxWidth('mobile')

// Thumbnail, name (spanned by the header's "Item"), category, status, mapping.
const columns = `
  display: grid;
  grid-template-columns: 74px minmax(0, 1.5fr) repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 16px;
`

export const ContractRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 32px;
  margin-bottom: 24px;
  padding: 16px 24px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};

  ${mobile} {
    padding: 12px 16px;
    gap: 8px 24px;
  }
`

export const ContractField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const ContractLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  text-transform: uppercase;
  color: ${theme.colors.offWhiteMuted};
`

export const ContractValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
`

export const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px -10px -10px 0;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: inherit;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.glassFaint};
  }
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const ListHeader = styled.div`
  ${columns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlayStrong};
  font-size: 14px;
  font-weight: 600;
  line-height: 1.57;
  color: ${theme.colors.softWhite};

  & > span:first-of-type {
    grid-column: span 2;
    font-weight: 700;
    font-size: 16px;
    text-align: left;
  }
  & > span {
    text-align: center;
  }

  ${card} {
    display: none;
  }
`

export const Row = styled.article`
  ${columns};
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

// Transparent in the table so the fields stay grid children; a wrapping block beside the thumbnail in the card.
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
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  color: ${theme.colors.softWhite};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${card} {
    flex-basis: 100%;
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
  text-align: center;

  ${card} {
    justify-content: flex-start;
    text-align: left;
  }
`

export const ItemStatus = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.8px solid;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;

  &[data-status='published'] {
    color: ${theme.colors.green};
    border-color: ${theme.colors.green};
    background: rgba(48, 205, 0, 0.2); /* green @ 20% */
  }
  &[data-status='under_review'] {
    color: ${theme.colors.amber};
    border-color: ${theme.colors.amber};
    background: rgba(244, 130, 33, 0.2); /* orangeStrong @ 20% */
  }
  &[data-status='rejected'] {
    color: ${theme.colors.redBright};
    border-color: ${theme.colors.redBright};
    background: rgba(204, 29, 44, 0.2); /* redRejected @ 20% */
  }
  &[data-status='not_published'] {
    color: ${theme.colors.infoLighter};
    border-color: ${theme.colors.infoLight};
    background: rgba(23, 100, 192, 0.4); /* info @ 40% */
  }
`
