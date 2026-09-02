import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { itemListColumns } from './ItemListRow/ItemListRow.styles'

export { FooterRow, Panel, PanelText, PanelTitle, ShowingCount } from '~/styles/shared'

const mobile = theme.media.maxWidth('mobile')

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
  padding-right: 8px;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: ${theme.colors.white};

  & svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: ${theme.colors.glassFaint};
  }
`

export const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;

  /* The pencil takes no room until the title is hovered/focused, so the status pill hugs the title. */
  &:hover [data-testid='rename-collection'],
  &:focus-within [data-testid='rename-collection'] {
    width: 32px;
    margin-left: 8px;
    opacity: 1;
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
    font-size: 20px;
  }
`

export const RenameButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 0;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: ${theme.colors.gray4};
  opacity: 0;
  overflow: hidden;
  transition:
    width 0.15s ease,
    margin 0.15s ease,
    opacity 0.15s ease;

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

export const SubHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
`

export const SubActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  ${mobile} {
    display: none;
  }
`

export const SectionLabel = styled.h2`
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};

  ${mobile} {
    font-size: 14px;
  }
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
  gap: 12px;
  min-height: 500px;
  padding: 48px 24px;
  border: 2px dashed ${theme.colors.glassLine};
  border-radius: ${theme.radius.dropzone};
  background: ${theme.colors.glassFaint};
  text-align: center;

  &[data-dragging] {
    border-color: ${theme.colors.white};
    background: ${theme.colors.glass};
  }

  ${mobile} {
    /* Mobile is a viewer: no drop affordance, plain overlay panel. */
    min-height: 0;
    padding: 48px 16px;
    border: 0;
    background: ${theme.colors.overlayLight};
  }
`

export const BrowseLink = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  color: ${theme.colors.white};
  text-decoration: underline;
  cursor: pointer;
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
  margin: 20px auto;

  &[data-mobile] {
    display: none;
  }

  ${mobile} {
    &[data-desktop] {
      display: none;
    }
    &[data-mobile] {
      display: block;
      font-size: 16px;
      font-weight: 700;
      margin: 16px auto 0;
    }
  }
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
      font-size: 14px;
      max-width: 340px;
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

// Loading placeholders mirror the loaded layout box-for-box so the page doesn't jump when data lands.
export const Loading = styled.div`
  display: contents;
`

export const SkeletonTitle = styled.div`
  width: 320px;
  max-width: 100%;
  height: 46px;
  border-radius: ${theme.radius.btn};

  ${mobile} {
    width: 60%;
    height: 32px;
  }
`

export const SkeletonButton = styled.div`
  width: 180px;
  height: 46px;
  border-radius: ${theme.radius.btn};

  &[data-compact] {
    width: 150px;
  }
  &[data-icon] {
    width: 46px;
  }
`

export const SkeletonLabel = styled.div`
  width: 120px;
  height: 24px;
  border-radius: ${theme.radius.btnSm};
`

export const SkeletonListHeader = styled.div`
  height: 49px;
  border-radius: ${theme.radius.card};

  ${mobile} {
    display: none;
  }
`

export const SkeletonRow = styled.div`
  height: 98px;
  border-radius: ${theme.radius.card};

  ${mobile} {
    height: 74px;
  }
`

export const SignInIconWrap = styled.div`
  display: flex;
  color: ${theme.colors.white};

  & svg {
    width: 72px;
    height: 72px;
  }
`
