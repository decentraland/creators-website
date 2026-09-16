import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${theme.z.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: ${theme.colors.scrim};
`

export const Dialog = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 560px;
  max-width: 80vw;
  height: max-content;
  max-height: 90vh;
  padding: 32px;
  border-radius: ${theme.radius.modal};
  background: ${theme.colors.modalSurface};
  color: ${theme.colors.white};
  box-shadow: 0 16px 48px ${theme.colors.overlayStrong};
  overflow: hidden;
  outline: none;

  &[data-size='large'] {
    width: 860px;
  }

  &[data-size='wide'] {
    width: max-content;
  }

  ${mobile} {
    padding: 24px 16px;
    max-width: 100%;
    max-height: 100%;
  }

  &[data-compact] {
    padding: 12px 16px 16px;
  }

  &[data-flush] {
    padding: 0;
  }
`

export const TitleBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 24px;

  [data-compact] > & {
    padding-bottom: 16px;
  }

  [data-flush] > & {
    padding: 16px;
  }
`

export const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.6;
  color: ${theme.colors.softWhite};
`

export const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: none;
  color: ${theme.colors.white};

  &:hover {
    background: ${theme.colors.glassFaint};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`

export const FloatingClose = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
`

export const Body = styled.div`
  /* The body owns the dialog's remaining height so tall content can scroll instead of clipping the footer;
     inner panes manage their own scroll. Short modals stay content-height (flex:1 is a no-op at max-content). */
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
`
