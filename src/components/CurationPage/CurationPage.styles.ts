import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { curationColumns } from './CurationRow/CurationRow.styles'

export { FooterRow, Panel, PanelText, PanelTitle, SearchBox, ShowingCount, Spinner } from '~/styles/shared'
export { Chip, Chips, Header, Page, SignInIcon, Title } from '~/components/CollectionsPage/CollectionsPage.styles'

const card = theme.media.maxWidth('lg')

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
