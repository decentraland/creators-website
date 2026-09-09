import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const ITEM_COLUMNS = 'minmax(0, 2fr) minmax(90px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) 88px'

export const Row = styled.div`
  display: grid;
  grid-template-columns: ${ITEM_COLUMNS};
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlay};
  font-size: 13px;
  color: ${theme.colors.softWhite};

  &[data-editing] {
    border-color: ${theme.colors.softWhite};
    background: ${theme.colors.overlayStrong};
  }

  & > *:not(:first-child) {
    justify-self: center;
    text-align: center;
  }
`

export const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const Name = styled.span`
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const NameInput = styled.input`
  width: 100%;
  min-width: 0;
  height: 30px;
  padding: 4px 8px;
  border: 1px solid ${theme.colors.softWhite};
  border-radius: ${theme.radius.chip};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.softWhite};
  font-size: 13px;
  outline: none;

  &[data-invalid] {
    border-color: ${theme.colors.errLight};
  }
  &:disabled {
    opacity: 0.6;
  }
`

export const SelectCell = styled.div`
  width: 130px;

  & [data-testid='rarity-select'] {
    height: 35px;
    padding: 4px 4px 4px 8px;
    gap: 4px;
    font-size: 12px;
    border-radius: 4px;
    border-color: ${theme.colors.softWhite};

    & span {
      gap: 4px;
      font-size: 12px;
      padding: 0;
      background: none;
    }
  }
`

export const Actions = styled.div`
  display: flex;
  gap: 8px;
`

export const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: none;
  color: ${theme.colors.white};

  & svg {
    font-size: 20px;
  }

  &:hover {
    background: ${theme.colors.glassFaint};
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
`

export const RowError = styled.p`
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  color: ${theme.colors.errLight};
  justify-self: start !important;
  text-align: left !important;
`

export const ThumbButton = styled.button`
  position: relative;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
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

  & svg {
    font-size: 16px;
  }
`
