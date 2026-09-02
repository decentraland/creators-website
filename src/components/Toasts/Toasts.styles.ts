import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Stack = styled.div`
  position: fixed;
  left: 24px;
  bottom: 24px;
  z-index: ${theme.z.prompt};
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: min(420px, calc(100vw - 48px));
`

export const ToastCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.text2};
  color: ${theme.colors.white};
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  box-shadow: 0 8px 24px ${theme.colors.overlayStrong};

  svg {
    flex-shrink: 0;
    color: ${theme.colors.successBorder};
  }
`

export const DismissButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 4px;
  border: 0;
  border-radius: ${theme.radius.chip};
  background: none;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.glassFaint};
  }

  svg {
    color: ${theme.colors.white};
  }
`
