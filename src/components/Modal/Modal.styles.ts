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
  /* The wide dialog's body owns the remaining height; inner panes manage their own scroll. */
  [data-size='large'] > &,
  [data-size='wide'] > & {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }
`
