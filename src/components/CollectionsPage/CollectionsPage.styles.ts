import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { listColumns } from './CollectionListRow/CollectionListRow.styles'

const mobile = theme.media.maxWidth('mobile')
const stacked = theme.media.maxWidth('xl')

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-top: 20px;

  ${mobile} {
    gap: 16px;
    padding-top: 4px;
  }
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;

  ${stacked} {
    flex-direction: column;
    align-items: stretch;
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
    font-size: 24px;
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

export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  width: 450px;
  max-width: 100%;
  padding: 7px 12px;
  border: 1px solid ${theme.colors.fieldBorder};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.gray4};

  &:focus-within {
    border-color: ${theme.colors.white};
  }

  ${stacked} {
    flex: 1;
    width: auto;
  }

  & input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    font: inherit;
    font-size: 17px;
    letter-spacing: -0.2px;
    color: ${theme.colors.white};

    &::placeholder {
      color: ${theme.colors.gray4};
    }
  }
`

export const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  min-width: 180px;
  padding: 0 12px;
  border-radius: ${theme.radius.btn};
  border: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0.46px;
  text-transform: uppercase;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &[data-variant='primary'] {
    background: ${theme.colors.dclRed};
    color: ${theme.colors.white};

    &:hover {
      background: ${theme.colors.dclRedHover};
    }
  }
  &[data-variant='secondary'] {
    background: none;
    border: 0.5px solid ${theme.colors.white};
    color: ${theme.colors.softWhite};

    &:hover {
      background: ${theme.colors.glassFaint};
    }
  }
  &[aria-disabled] {
    opacity: 0.6;
    cursor: default;
  }
`

export const ActionLink = ActionButton.withComponent('a')

export const FilterRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
  font-weight: 600;
  line-height: 1.57;
  color: ${theme.colors.softWhite};

  & > span:first-of-type {
    font-weight: 700;
    font-size: 16px;
  }
`

export const ListHeaderActions = styled.span`
  text-align: right;
`

export const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  ${mobile} {
    flex-direction: column;
    align-items: center;
  }
`

export const ShowingCount = styled.span`
  font-size: 14px;
  line-height: 1.57;
  color: ${theme.colors.gray4};
`

export const Pagination = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const PageButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.softWhite};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.46px;

  &[aria-label] {
    border: 0.5px solid ${theme.colors.glassLine};
  }
  &:hover:not(:disabled):not([data-current]) {
    background: ${theme.colors.glassFaint};
  }
  &[data-current] {
    background: ${theme.colors.softWhite};
    color: ${theme.colors.text};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`

// Shared shell for the sign-in / empty / error / no-results states.
export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 150px 24px;
  border-radius: ${theme.radius.banner};
  background: ${theme.colors.overlayLight};
  text-align: center;

  ${mobile} {
    gap: 20px;
    padding: 48px 20px;
  }
`

export const PanelTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};

  ${mobile} {
    font-size: 18px;
  }
`

export const PanelText = styled.p`
  margin: -20px 0 0;
  max-width: 640px;
  font-size: 16px;
  line-height: 1.6;
  color: ${theme.colors.softWhite};

  &[data-mobile] {
    display: none;
  }

  ${mobile} {
    margin-top: -8px;
    font-size: 14px;

    &[data-desktop] {
      display: none;
    }
    &[data-mobile] {
      display: block;
    }
  }
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
    width: 72px;
    height: 72px;
  }
`

export const SkeletonCard = styled.div`
  height: 318px;
  border-radius: ${theme.radius.cardLg};

  ${mobile} {
    height: 128px;
    border-radius: ${theme.radius.card};
  }
`
