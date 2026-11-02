import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { theme } from '~/styles/theme'

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
`

export const AssigneeChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 36px;
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
`
