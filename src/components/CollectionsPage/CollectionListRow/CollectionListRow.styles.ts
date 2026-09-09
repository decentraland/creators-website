import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')
const desktop = theme.media.minWidth('mobile')

// Shared column template so the header and the rows stay aligned.
export const listColumns = `
  display: grid;
  grid-template-columns: minmax(220px, 2fr) minmax(90px, 1fr) minmax(110px, 1fr) minmax(140px, 1fr) minmax(110px, 1fr) 56px;
  align-items: center;
  gap: 16px;
`

export const Row = styled.article`
  ${listColumns};
  position: relative;
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;

  /* Inner 2px gradient border: gradient layer with the padding-box masked out. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 2px;
    background: ${theme.gradients.cerise};
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &:hover,
  &:focus-within {
    background: ${theme.colors.overlayHover};
    box-shadow: 0 0 8px ${theme.colors.brandViolet};

    &::after {
      opacity: 1;
    }
  }

  /* The view toggle is desktop-only state; on mobile the row reshapes into the card layout. */
  ${mobile} {
    display: flex;
    flex-direction: column;
    /* listColumns' align-items: center would center the stacked cells horizontally here. */
    align-items: stretch;
    justify-content: center;
    gap: 8px;
    height: 136px;
    padding: 16px 12px 16px calc(136px + 16px);
    overflow: hidden;

    & [data-testid='collection-row-created'] {
      display: none;
    }
  }
`

// The row's single real link: its ::after stretches over the row so the whole
// surface navigates while keeping the actions button outside the anchor.
export const RowLink = styled(Link)`
  display: block;
  min-width: 0;
  text-decoration: none;
  outline: none;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }
`

export const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  ${mobile} {
    display: contents;
  }
`

export const Thumb = styled.div`
  flex: none;
  width: 74px;
  height: 74px;
  border-radius: 6px;
  overflow: hidden;

  ${mobile} {
    position: absolute;
    top: 0;
    left: 0;
    width: 136px;
    height: 100%;
    border-radius: 0;
  }
`

export const Name = styled.h3`
  margin: 0;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
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

  ${desktop} {
    text-align: center;
  }
`

export const DateCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  ${desktop} {
    align-items: center;
    text-align: center;
  }

  & strong {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.57;
    color: ${theme.colors.softWhite};
  }
  & span {
    font-size: 12px;
    color: ${theme.colors.gray4};
  }

  ${mobile} {
    & span {
      display: none;
    }
  }
`

export const ActionsCell = styled.div`
  display: flex;
  justify-content: flex-end;

  ${mobile} {
    display: none;
  }
`
