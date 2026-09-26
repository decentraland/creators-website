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

// Shared by the list header and every row so their columns stay aligned.
export const curationColumns = `
  display: grid;
  grid-template-columns: minmax(220px, 2fr) minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(200px, 1.4fr);
  align-items: center;
  gap: 16px;
`

export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  ${card} {
    flex-direction: column;
    align-items: stretch;
  }
`

export const Selects = styled.div`
  display: flex;
  gap: 12px;

  & > * {
    min-width: 200px;
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
