import styled from '@emotion/styled'
import { Button } from '~/components/Button'
import { theme } from '~/styles/theme'

export {
  Workspace,
  Columns,
  Handle,
  PanelBody,
  CenterPanel,
  PreviewArea,
  PreviewEmpty,
  StatePanel,
  StateTitle,
  StateText,
  Field,
  FieldLabel,
  TextInput,
  Toggle,
  Footer,
  MobileWorkspace,
  MobilePreviewArea,
  MobileHint
} from '~/components/ItemEditorPage/ItemEditorPage.styles'

export const SidePanel = styled.aside`
  height: 100%;
`

export const StatusPill = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid currentColor;
  border-radius: ${theme.radius.pill};
  background: color-mix(in srgb, currentColor 15%, transparent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: none;
  color: ${theme.editor.label};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  &[data-status='connected'] {
    color: ${theme.colors.success};
  }

  &[data-status='connecting'] {
    color: ${theme.colors.warningText};
  }

  &[data-status='error'] {
    color: ${theme.colors.errLight};
  }
`

export const InputRow = styled.div`
  display: flex;
  gap: 8px;

  & > input {
    flex: 1;
    min-width: 0;
  }
`

export const ConnectButton = styled(Button)`
  &[data-size='sm'] {
    flex: none;
    height: 46px;
  }
`

export const AddButton = styled(Button)`
  width: 100%;
`

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  & > button {
    flex: none;
  }
`

export const Meta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.editor.label};

  & svg {
    width: 14px;
    height: 14px;
  }
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const PermissionCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 420px;
  padding: 24px;
  border-radius: ${theme.radius.card};
  background: ${theme.editor.surface};
  text-align: center;
  color: ${theme.colors.white};

  & svg {
    width: 40px;
    height: 40px;
    color: ${theme.colors.warningText};
  }

  &[data-state='denied'] svg {
    color: ${theme.colors.errLight};
  }

  & h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  & p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: ${theme.editor.label};
  }

  & ol {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
    line-height: 1.6;
    text-align: left;
  }
`

export const CardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
`

export const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 24px;
`

export const ModalText = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  color: ${theme.colors.gray4};
`

export const ModalField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: ${theme.colors.softWhite};
`

export { ModalActions } from '~/styles/shared'
