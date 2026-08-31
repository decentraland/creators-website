import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

// Shared column template so the header and the rows stay aligned.
export const itemListColumns = `
  display: grid;
  grid-template-columns: minmax(200px, 2fr) minmax(90px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(110px, 1fr) 56px;
  align-items: center;
  gap: 16px;
`

export const Row = styled.article`
  ${itemListColumns};
  position: relative;
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
  transition: background 0.15s ease;

  &:hover,
  &:focus-within {
    background: ${theme.colors.overlayHover};
  }

  ${mobile} {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 4px;
    padding: 12px;
  }
`

export const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  ${mobile} {
    grid-row: span 2;
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
    width: 50px;
    height: 50px;
  }
`

export const NameLink = styled(Link)`
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  color: ${theme.colors.softWhite};
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;

  /* Stretched over the whole row so the row is one real link. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
`

export const Cell = styled.div`
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
  text-align: center;

  ${mobile} {
    text-align: right;
  }

  &[data-desktop] {
    ${mobile} {
      display: none;
    }
  }
`

// Figma "Rarity Label": fill = rarity color @ 33%, border/text = the rarity's light gradient stop.
export const RarityPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.5px solid var(--rarity-light, ${theme.colors.gray4});
  background: color-mix(in srgb, var(--rarity-color, ${theme.colors.gray4}) 33%, transparent);
  color: var(--rarity-light, ${theme.colors.gray4});
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;
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
