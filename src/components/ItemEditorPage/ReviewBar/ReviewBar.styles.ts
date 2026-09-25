import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const ReviewBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  min-height: 56px;
  padding: 8px 12px;
  border-bottom: 1px solid ${theme.editor.line};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};
`

export const Identity = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
  margin: -6px 0;
  border-radius: 50%;
  color: ${theme.colors.white};

  &:hover,
  &:focus-visible {
    background: ${theme.editor.surfaceHover};
  }
`

export const Name = styled.h1`
  margin: 0;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  font-size: 14px;
  color: ${theme.editor.label};

  ${mobile} {
    flex: 1 1 100%;
    justify-content: space-between;
  }
`

export const AssigneeChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.pill};
  background: transparent;
  color: ${theme.colors.white};
  font-size: 14px;
  font-weight: 600;

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${theme.editor.surfaceHover};
  }
  &:disabled {
    cursor: default;
  }
`

export const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;

  ${mobile} {
    flex: 1 1 100%;
    margin-left: 0;

    & > * {
      flex: 1;
      min-height: 44px;
    }
  }
`

export const FlowBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 16px;
`

export const FlowText = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const FlowCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
`

export const DoneGlyph = styled.span`
  display: flex;
  color: ${theme.colors.green};

  & svg {
    width: 56px;
    height: 56px;
  }
`

export { ModalActions as FlowActions } from '~/styles/shared'
