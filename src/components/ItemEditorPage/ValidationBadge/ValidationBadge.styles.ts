import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Badge = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 48px;
  padding: 0 12px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 13px;

  &:hover:not(:disabled) {
    background: ${theme.editor.surfaceHover};
  }

  &:disabled {
    cursor: default;
  }

  &[data-status='pass'] svg {
    color: ${theme.colors.ok};
  }
  &[data-status='warnings'] svg {
    color: ${theme.colors.amber};
  }
  &[data-status='errors'] svg {
    color: ${theme.colors.errLight};
  }
`

export const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: ${theme.colors.white};
  animation: spin 0.8s linear infinite;
`

export const IssueList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Issue = styled.li`
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 14px;
  line-height: 1.4;

  &[data-severity='error'] {
    background: ${theme.colors.errOverlay};
    color: ${theme.colors.white};
  }

  & svg {
    flex: none;
  }
`

export const Empty = styled.p`
  margin: 0;
  color: ${theme.colors.softWhite};
`
