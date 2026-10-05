import styled from '@emotion/styled'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { Spinner } from '~/styles/shared'
import { theme } from '~/styles/theme'

export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const Thumbnail = styled(ItemThumbnail)`
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: ${theme.radius.chip};
`

export const SubjectText = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.57;
`

export const SubjectName = styled.span`
  overflow: hidden;
  color: ${theme.colors.softWhite};
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SubjectMeta = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: ${theme.colors.gray4};
  font-size: 12px;
`

export const Rerun = styled.button`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -6px -6px -6px 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: ${theme.colors.softWhite};
  cursor: pointer;

  &:hover:not([aria-disabled]),
  &:focus-visible {
    background: ${theme.colors.glassFaint};
  }

  &[aria-disabled] {
    cursor: default;
    opacity: 0.6;
  }

  &[data-running] svg {
    animation: spin 0.8s linear infinite;
  }
`

export const Running = styled.div`
  display: flex;
  justify-content: center;
  padding: 16px 0;
`

export { Spinner }

export const IssueList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Issue = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  border: 1px solid transparent;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 12px;
  line-height: 1.334;

  & > svg {
    flex: none;
    color: ${theme.colors.amber};
  }

  &[data-severity='error'] {
    border-color: ${theme.colors.redRejected};
    background: ${theme.colors.errorOverlay};
    color: ${theme.colors.errorText};
  }
  &[data-severity='error'] > svg {
    color: ${theme.colors.errLight};
  }
`

export const IssueText = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
`

export const IssueTitle = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;

  & strong {
    font-weight: 700;
  }
`

export const ShapeLabel = styled.span`
  padding: 0 6px;
  border: 1px solid currentColor;
  border-radius: ${theme.radius.chip};
  font-size: 11px;
  line-height: 16px;
`

export const Empty = styled.p`
  margin: 0;
  color: ${theme.colors.softWhite};
`
