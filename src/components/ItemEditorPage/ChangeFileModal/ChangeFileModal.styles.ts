import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export {
  Content,
  ErrorText,
  Field,
  FieldHint,
  FieldLabel,
  Footer,
  FooterRight,
  FormHeading,
  FormPane,
  Layout,
  Main
} from '~/components/ItemDraftModal/ItemDraftModal.styles'

/** The file step: the video modal's width and drop area, the details step then widens the modal. */
export const PickStep = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 560px;
  max-width: 100%;
`

export const Dropzone = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 280px;
  padding: 32px 24px;
  border: 2px dashed ${theme.colors.glassLine};
  border-radius: ${theme.radius.dropzone};
  background: ${theme.colors.glassFaint};
  text-align: center;

  &[data-dragging] {
    border-color: ${theme.colors.white};
    background: ${theme.colors.glass};
  }

  &[data-busy] > :not([data-spinner]) {
    opacity: 0.5;
    pointer-events: none;
  }

  ${theme.media.maxWidth('mobile')} {
    min-height: 200px;
    padding: 24px 16px;
  }
`

export const DropIcon = styled.span`
  display: inline-flex;
  color: ${theme.colors.gray4};

  svg {
    width: 32px;
    height: 32px;
  }
`

export const DropText = styled.span`
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const DropFormats = styled.span`
  font-size: 12px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const Spinner = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  margin: -14px 0 0 -14px;
  border-radius: 50%;
  border: 3px solid ${theme.colors.glass};
  border-top-color: ${theme.colors.white};
  animation: spin 0.8s linear infinite;
`

export const BrowseLink = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  color: ${theme.colors.white};
  text-decoration: underline;
  cursor: pointer;
`

export const DropError = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.errStrong};
`

export const PickActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const ThumbnailToggle = styled.div`
  font-size: 14px;
  color: ${theme.colors.softWhite};
`
