import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Stack = styled.div`
  position: fixed;
  top: calc(var(--nav-h) + var(--sub-nav-h) + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: ${theme.z.prompt};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: min(450px, calc(100vw - 48px));

  body[data-fullscreen] & {
    top: 16px;
  }
`

export const ToastCard = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  border-radius: ${theme.radius.cardLg};
  background: ${theme.colors.text2};
  color: ${theme.colors.white};
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
`

export const TypeIcon = styled.span`
  display: flex;
  flex-shrink: 0;

  &[data-type='success'] {
    color: ${theme.colors.success};
  }

  &[data-type='error'] {
    color: ${theme.colors.errLight};
  }

  &[data-type='warn'] {
    color: ${theme.colors.amber};
  }

  &[data-type='info'] {
    color: ${theme.colors.infoLight};
  }
`

export const DismissButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 4px;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.glassFaint};
  }
`
