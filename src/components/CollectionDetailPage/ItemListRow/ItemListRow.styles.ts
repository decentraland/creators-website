import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

// Shared column template so the header and the rows stay aligned: thumbnail, then four equal
// columns (name, body shape, category, rarity), then actions. The header's "Item" spans the first two.
export const itemListColumns = `
  display: grid;
  grid-template-columns: 74px repeat(4, minmax(0, 1fr)) minmax(56px, auto);
  align-items: center;
  gap: 16px;
`

export const Row = styled.article`
  ${itemListColumns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};

  ${mobile} {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }
`

// Transparent on desktop so name and fields stay grid children; a wrapping row beside the thumbnail on mobile.
export const Content = styled.div`
  display: contents;

  ${mobile} {
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
  background: ${theme.colors.media};
  overflow: hidden;

  & img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  ${mobile} {
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

  ${mobile} {
    justify-content: flex-start;
  }
`

export const ActionsCell = styled.div`
  display: flex;
  justify-content: flex-end;

  ${mobile} {
    display: none;
  }
`

export const ActionsButton = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${theme.colors.lineStrong};
  border-radius: ${theme.radius.chip};
  background: none;
  color: ${theme.colors.softWhite};

  &:hover {
    background: ${theme.colors.glass};
  }
  &[aria-disabled] {
    opacity: 0.6;
    cursor: default;
  }
`
