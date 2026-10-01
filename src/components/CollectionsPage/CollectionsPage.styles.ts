import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { listColumns } from './CollectionListRow/CollectionListRow.styles'

import { SearchBox as SharedSearchBox } from '~/styles/shared'

export {
  Chip,
  Chips,
  FooterRow,
  Header,
  Page,
  Panel,
  PanelText,
  PanelTitle,
  ShowingCount,
  SignInIcon,
  Spinner,
  Title
} from '~/styles/shared'

const mobile = theme.media.maxWidth('mobile')
const noActions = theme.media.noActions

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  ${noActions} {
    /* Mobile is a viewer: collections are searched and managed from desktop. */
    display: none;
  }
`

export const SearchBox = SharedSearchBox

export const FilterRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`

export const ChipBadge = styled.span`
  position: absolute;
  top: -5px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.dclRed};
  color: ${theme.colors.white};
  font-size: 12px;
  font-weight: 600;
`

export const ViewToggle = styled.div`
  display: flex;
  border-radius: ${theme.radius.btn};
  overflow: hidden;

  ${mobile} {
    display: none;
  }
`

export const ViewButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  background: ${theme.colors.glass};
  color: ${theme.colors.white};
  transition: background 0.15s ease;

  &:hover {
    background: ${theme.colors.glassHover};
  }
  &[data-active] {
    background: ${theme.colors.white};
    color: ${theme.colors.text};
  }
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;

  ${mobile} {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  ${theme.media.withActions} {
    overflow-x: auto;

    & > * {
      min-width: 950px;
    }
  }
`

export const ListHeader = styled.div`
  ${listColumns};
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlayStrong};
  font-size: 14px;
  font-weight: 400;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
  text-align: center;

  & > span:first-of-type {
    text-align: left;
  }

  ${noActions} {
    display: none;
  }
`

export const ListHeaderActions = styled.span`
  text-align: right;
`

export const EmptyArt = styled.img`
  width: 390px;
  max-width: 80%;
  height: auto;
`

export const EmptyActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  & [data-variant='secondary'] {
    min-width: 240px;
  }

  ${noActions} {
    /* Mobile is a viewer: collections are created from desktop. */
    display: none;
  }
`

export const SkeletonCard = styled.div`
  height: 318px;
  border-radius: ${theme.radius.cardLg};

  ${mobile} {
    height: 136px;
    border-radius: ${theme.radius.card};
  }
`
