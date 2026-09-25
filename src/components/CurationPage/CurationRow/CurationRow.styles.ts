import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { theme } from '~/styles/theme'

const card = theme.media.maxWidth('lg')
const table = theme.media.minWidth('lg')

export const curationColumns = `
  display: grid;
  grid-template-columns: minmax(220px, 2fr) minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(200px, 1.4fr);
  align-items: center;
  gap: 16px;
`

export const Row = styled.article`
  ${curationColumns};
  position: relative;
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
  color: ${theme.colors.softWhite};
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;

  &:hover,
  &:focus-within {
    background: ${theme.colors.overlayHover};
    box-shadow: 0 0 8px ${theme.colors.brandViolet};
  }

  ${card} {
    display: grid;
    grid-template-columns: 88px 1fr auto;
    grid-template-areas:
      'thumb name state'
      'thumb owner owner'
      'thumb requested requested'
      'assignee assignee assignee';
    gap: 8px 12px;
    padding: 12px;
  }
`

export const RowLink = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  outline: none;

  ${card} {
    grid-area: name;
  }

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

  ${card} {
    display: contents;
  }
`

export const Thumb = styled.div`
  flex: none;
  width: 74px;
  height: 74px;
  border-radius: 6px;
  overflow: hidden;

  ${card} {
    grid-area: thumb;
    width: 88px;
    height: 88px;
  }
`

export const Name = styled.h3`
  margin: 0;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const Sub = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.57;

  ${table} {
    align-items: center;
    text-align: center;
  }

  ${card} {
    &[data-cell='owner'] {
      grid-area: owner;
    }
    &[data-cell='requested'] {
      grid-area: requested;
      flex-direction: row;
      gap: 6px;
      font-weight: 400;
    }
    &[data-cell='updated'] {
      display: none;
    }
    &[data-cell='state'] {
      grid-area: state;
      align-self: start;
    }
  }
`

export const CellLabel = styled.span`
  font-size: 12px;
  font-weight: 400;
  color: ${theme.colors.gray4};
`

/* Sits above the row's stretched link so its buttons stay clickable. */
export const AssigneeCell = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;

  ${card} {
    grid-area: assignee;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid ${theme.colors.glassFaint};
  }
`

export const Unassigned = styled.span`
  color: ${theme.colors.gray4};
  font-weight: 400;
`

export const IconAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px -10px -10px 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: ${theme.colors.white};

  &:hover,
  &:focus-visible {
    background: ${theme.colors.glassFaint};
  }
`

export const TextAction = styled.button`
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: ${theme.colors.white};
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
`
