import styled from '@emotion/styled'
import { Button } from '~/components/Button'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  position: relative;
  flex: none;
`

export const Trigger = styled(Button)`
  &[data-compact] {
    width: 32px;
    height: 32px;
  }
`

export const Menu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: ${theme.z.overlay};
  min-width: 240px;
  padding: 8px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.modalSurface};
  box-shadow: 0 16px 48px ${theme.colors.overlayStrong};
`

export const Item = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: none;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
  color: ${theme.colors.softWhite};

  &:hover:not([aria-disabled]),
  &:focus-visible {
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
    outline: none;
  }
  &[aria-disabled] {
    opacity: 0.5;
    cursor: default;
  }
`

export const Divider = styled.div`
  height: 1px;
  margin: 8px 4px;
  background: ${theme.colors.glassFaint};
`
