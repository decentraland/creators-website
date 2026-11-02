import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')
const card = theme.media.noActions

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

export const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 12px 16px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 14px;
  line-height: 1.5;

  & svg {
    flex: none;
  }
`

// Checkbox · thumbnail · name · category · status · linked to · actions. The mapping editor gets the widest track
// since it holds a select and an input side by side.
const columns = `
  display: grid;
  grid-template-columns: 36px 74px minmax(0, 1.4fr) minmax(0, 1fr) minmax(136px, 1fr) minmax(260px, 2fr) minmax(56px, auto);
  align-items: center;
  gap: 16px;

  /* Readers get no checkbox nor status column. */
  &[data-reader] {
    grid-template-columns: 74px minmax(0, 1.4fr) minmax(0, 1fr) minmax(260px, 2fr) minmax(56px, auto);
  }
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  ${theme.media.withActions} {
    overflow-x: auto;

    & > * {
      min-width: 1100px;
    }
  }
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

  & > span {
    text-align: center;
  }
  & > span[data-name] {
    grid-column: span 2;
    font-weight: 700;
    font-size: 16px;
    text-align: left;
  }
  & > span:last-of-type {
    text-align: right;
  }

  /* With items selected the row reads as a toolbar for them, in place of the column labels. */
  &[data-selecting] {
    box-shadow: inset 0 0 0 1px ${theme.colors.glassLine};
  }

  ${card} {
    display: none;
  }
`

export const SelectionSummary = styled.div`
  grid-column: 2 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
`

export const SelectionCount = styled.span`
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
  white-space: nowrap;
`

export const SelectionActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const HeaderSelect = styled.span`
  display: flex;
  justify-content: center;

  & input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: ${theme.colors.accent};
    cursor: pointer;
  }
`

export const Row = styled.article`
  ${columns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};

  &[data-selected] {
    box-shadow: inset 0 0 0 1px ${theme.colors.glassLine};
  }

  ${card} {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }
`

export const SelectCell = styled.div`
  display: flex;
  justify-content: center;

  & input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: ${theme.colors.accent};
    cursor: pointer;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  ${card} {
    display: none;
  }
`

export const NameCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  color: ${theme.colors.softWhite};

  ${card} {
    flex: 1 1 160px;
  }
`

export const Urn = styled.span`
  font-size: 12px;
  font-weight: 400;
  color: ${theme.colors.offWhiteMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const MappingCell = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  color: ${theme.colors.softWhite};

  ${card} {
    flex: 1 1 100%;
  }
`

export const ItemCount = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  color: ${theme.colors.softWhite};
`

export const StatusRetry = styled.button`
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: ${theme.colors.softWhite};
  font: inherit;
  text-decoration: underline;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }
`
