import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Shared column template so the header and the rows stay aligned.
export const listColumns = `
  display: grid;
  grid-template-columns: minmax(220px, 2fr) minmax(90px, 1fr) minmax(110px, 1fr) minmax(140px, 1fr) minmax(110px, 1fr) 56px;
  align-items: center;
  gap: 16px;
`

export const Row = styled.article`
  ${listColumns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.overlayHover};
    outline: none;
  }
`

export const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const Thumb = styled.div`
  flex: none;
  width: 74px;
  height: 74px;
  border-radius: 6px;
  overflow: hidden;
`

export const Name = styled.h3`
  margin: 0;
  min-width: 0;
  font-size: 16px;
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
`

export const DateCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

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
`

export const ActionsCell = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const ActionsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.softWhite};

  &:hover {
    background: ${theme.colors.glass};
  }
`
