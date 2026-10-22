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
  Main,
  ProcessingPane,
  ProcessingSpinner
} from '~/components/ItemDraftModal/ItemDraftModal.styles'

export const Dropzone = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 1045px;
  max-width: 100%;
  min-height: 420px;
  padding: 48px 24px;
  border: 2px dashed ${theme.colors.glassLine};
  border-radius: ${theme.radius.dropzone};
  background: ${theme.colors.glassFaint};
  text-align: center;

  &[data-dragging] {
    border-color: ${theme.colors.white};
    background: ${theme.colors.glass};
  }

  ${theme.media.maxWidth('mobile')} {
    min-height: 280px;
    padding: 32px 16px;
  }
`

export const DropIcon = styled.span`
  display: inline-flex;
  color: ${theme.colors.gray4};

  svg {
    width: 48px;
    height: 48px;
  }
`

export const DropTitle = styled.h3`
  margin: 8px 0 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const DropText = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: ${theme.colors.softWhite};
`

export const DropFormats = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: ${theme.colors.gray4};
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
  font-size: 14px;
  line-height: 1.6;
  color: ${theme.colors.dclRed};
`

export const ThumbnailToggle = styled.div`
  font-size: 14px;
  color: ${theme.colors.softWhite};
`
