import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export {
  Chip,
  Chips,
  FooterRow,
  Header,
  Page,
  Panel,
  PanelText,
  PanelTitle,
  SearchBox,
  ShowingCount,
  SignInIcon,
  Spinner,
  Title
} from '~/styles/shared'

const card = theme.media.maxWidth('lg')
const table = theme.media.minWidth('lg')

// Shared by the list header and every row so their columns stay aligned.
export const curationColumns = `
  display: grid;
  grid-template-columns: minmax(220px, 2fr) minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(140px, 1fr);
  align-items: center;
  gap: 16px;
`

export const FilterRow = styled.div`
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  ${card} {
    flex-direction: column;
    align-items: stretch;
  }
`

export const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;

  ${theme.media.maxWidth('mobile')} {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
`

export const CampaignToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
  white-space: nowrap;
  cursor: pointer;
`

export const Selects = styled.div`
  display: flex;
  gap: 12px;

  & > * {
    min-width: 160px;
  }

  ${theme.media.maxWidth('mobile')} {
    & > * {
      flex: 1;
      min-width: 0;
    }
  }
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  ${table} {
    overflow-x: auto;
    /* Room for the rows' hover glow, which the scroll container would otherwise clip. */
    padding: 8px;
    margin: -8px;

    & > * {
      min-width: 960px;
    }
  }
`

export const ListHeader = styled.div`
  ${curationColumns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlayStrong};
  font-size: 14px;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
  text-align: center;

  & > span:first-of-type {
    text-align: left;
  }
  & > span:last-of-type {
    text-align: right;
  }

  ${card} {
    display: none;
  }
`

export const SkeletonRow = styled.div`
  height: 98px;
  border-radius: ${theme.radius.card};
`
