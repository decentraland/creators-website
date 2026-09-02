import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { listColumns } from './CollectionListRow/CollectionListRow.styles'

import { SearchBox as SharedSearchBox } from '~/styles/shared'

export {
  ActionButton,
  ActionLink,
  FooterRow,
  Panel,
  PanelText,
  PanelTitle,
  SearchSpinner,
  ShowingCount
} from '~/styles/shared'

const mobile = theme.media.maxWidth('mobile')
const stacked = theme.media.maxWidth('xl')

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;

  ${mobile} {
    gap: 24px;
    padding-top: 12px;
  }
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding-bottom: 12px;

  ${stacked} {
    flex-flow: row wrap;
    gap: 16px;
  }
`

export const Title = styled.h1`
  min-width: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};

  ${mobile} {
    font-size: 20px;
  }
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  ${mobile} {
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

export const Chips = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  ${mobile} {
    overflow-x: auto;
    scrollbar-width: none;
    padding: 5px 0;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  /* Chips only overflow below ~490px, a non-canonical width */
  @media (max-width: 490px) {
    mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
  }
`

export const Chip = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  background: ${theme.colors.glass};
  color: ${theme.colors.white};
  font-size: 14px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0.46px;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: ${theme.colors.glassHover};
  }
  &[data-active] {
    background: ${theme.colors.softWhite};
    color: ${theme.colors.text};
  }
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

  ${mobile} {
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

  ${mobile} {
    /* Mobile is a viewer: collections are created from desktop. */
    display: none;
  }
`

export const SignInIcon = styled.div`
  display: flex;
  color: ${theme.colors.white};

  & svg {
    width: 140px;
    height: 140px;
  }

  ${mobile} {
    & svg {
      width: 100px;
      height: 100px;
    }
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
