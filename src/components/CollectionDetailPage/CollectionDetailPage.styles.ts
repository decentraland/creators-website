import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SearchBox as SharedSearchBox } from '~/styles/shared'
import { itemListColumns } from './ItemListRow/ItemListRow.styles'

export { ActionButton, FooterRow, Panel, PanelText, PanelTitle, ShowingCount } from '~/styles/shared'

const mobile = theme.media.maxWidth('mobile')
const stacked = theme.media.maxWidth('xl')

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
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

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

export const BackLink = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.white};

  &:hover {
    background: ${theme.colors.glassFaint};
  }
`

export const Title = styled.h1`
  min-width: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${mobile} {
    font-size: 24px;
    white-space: normal;
  }
`

export const RenameButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.gray4};

  &:hover {
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
  }

  ${mobile} {
    /* Mobile is a viewer: collections are managed from desktop. */
    display: none;
  }
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  ${mobile} {
    display: none;
  }
`

export const SearchBox = styled(SharedSearchBox)`
  ${stacked} {
    flex: 1;
    width: auto;
  }
`

export const MoreButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 46px;
  height: 46px;
  border: 1px solid ${theme.colors.softWhite};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.glassHover};
  color: ${theme.colors.softWhite};

  &:hover {
    background: ${theme.colors.glassLine};
  }
  &[aria-disabled] {
    opacity: 0.6;
    cursor: default;
  }
`

export const SectionLabel = styled.h2`
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const ListHeader = styled.div`
  ${itemListColumns};
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
    text-align: left;
  }
  & > span {
    text-align: center;
  }

  ${mobile} {
    display: none;
  }
`

export const ListHeaderActions = styled.span`
  && {
    text-align: right;
  }
`

export const Dropzone = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 600px;
  padding: 48px 24px;
  border: 2px dashed ${theme.colors.glassLine};
  border-radius: ${theme.radius.dropzone};
  background: ${theme.colors.glassFaint};
  text-align: center;

  ${mobile} {
    min-height: 0;
    padding: 48px 20px;
  }
`

export const DropArt = styled.img`
  width: 256px;
  max-width: 60%;
  height: auto;
`

export const DropTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const DropText = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: ${theme.colors.softWhite};

  & u {
    font-weight: 700;
    color: ${theme.colors.white};
  }

  &[data-mobile] {
    display: none;
  }

  ${mobile} {
    &[data-desktop] {
      display: none;
    }
    &[data-mobile] {
      display: block;
    }
  }
`

export const DropFormats = styled.p`
  margin: -8px 0 0;
  font-size: 14px;
  color: ${theme.colors.gray4};

  ${mobile} {
    display: none;
  }
`

export const SkeletonRow = styled.div`
  height: 98px;
  border-radius: ${theme.radius.card};
`

export const SkeletonHeader = styled.div`
  height: 46px;
  max-width: 480px;
  border-radius: ${theme.radius.card};
`

export const SignInIconWrap = styled.div`
  display: flex;
  color: ${theme.colors.white};

  & svg {
    width: 72px;
    height: 72px;
  }
`
