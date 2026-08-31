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
  background: ${theme.colors.overlayStrong};
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  width: 560px;
  max-width: 100%;
  max-height: 100%;
  padding: 32px;
  border-radius: ${theme.radius.modal};
  background: ${theme.colors.modalSurface};
  color: ${theme.colors.white};
  box-shadow: 0 16px 48px ${theme.colors.overlayStrong};
  overflow: hidden;
  outline: none;

  ${mobile} {
    padding: 24px 16px;
  }
`

export const TitleBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${theme.colors.gray0};
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

export const Body = styled.div`
  padding-top: 48px;
  overflow-y: auto;

  ${mobile} {
    padding-top: 32px;
  }
`
