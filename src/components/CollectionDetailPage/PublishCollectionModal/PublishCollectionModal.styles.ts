import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { Spinner } from '~/styles/shared'

export const Main = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 16px;
  min-height: min(700px, 70vh);
`

export const Step = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 32px;
  gap: 16px;
  overflow: auto;

  & [data-testid='checkbox-label'] {
    margin-top: auto;
    padding-left: 12px;
  }
`

// Everything but the footer; while the wallet prompt is pending it goes inert and dims like the add-items upload.
export const Fields = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &[data-busy] {
    pointer-events: none;
    opacity: 0.7;
  }
`

export const Heading = styled.h3`
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.5;
  color: ${theme.colors.white};
`

export const Lead = styled.p`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: ${theme.colors.white};
`

export const Text = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const TooltipText = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

// The "publication fee" term in the step intro: highlighted, with its info tooltip glued to it.
export const FeeTerm = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${theme.colors.softWhite};

  & svg {
    font-size: 16px;
  }
`

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 32px;
  margin: 32px 0;
`

export const EmailField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const EmailInput = styled.input`
  height: 54px;
  padding: 0 16px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: 8px;
  outline: 0;
  background: rgba(255, 255, 255, 0.05);
  font: inherit;
  font-size: 18px;
  color: ${theme.colors.white};

  &::placeholder {
    color: ${theme.colors.muted2};
  }

  &:focus {
    border: 1.5px solid ${theme.colors.white};
    padding: 0 15.5px;
  }

  &[data-invalid] {
    background: ${theme.colors.errOverlay};
    border-color: ${theme.colors.errLight};
  }
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid ${theme.colors.glassHover};
  background: ${theme.colors.modalSurface};
  position: sticky;
  bottom: 0;

  & > button {
    min-width: 250px;
  }
`

export const Table = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow: hidden;
`

export const TableHeader = styled.div`
  display: grid;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayStrong};
  font-size: 13px;
  line-height: 1.2;
  color: ${theme.colors.softWhite};
  margin-top: 16px;

  & > span:not(:first-of-type) {
    text-align: center;
  }
`

export const TableBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 35vh;
  padding-right: 4px;
  overflow-y: auto;
`

export const SummaryTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SummaryRow = styled.div`
  display: grid;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlay};
  font-size: 14px;
  color: ${theme.colors.softWhite};

  & > *:not(:first-child) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-align: center;
  }
`

export const SummaryName = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  & > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const SummaryTotal = styled.span`
  font-size: 16px;
  font-weight: 700;
`

export const PaymentMethods = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
`

export const Thumb = styled.span`
  display: block;
  flex: none;
  width: 74px;
  height: 74px;
  border-radius: 6px;
  overflow: hidden;
`

export const MosaicFrame = styled.span`
  display: block;
  flex: none;
  width: 74px;
  height: 74px;
  border-radius: 6px;
  overflow: hidden;
`

export const InlineNote = styled.p`
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 8px;
  margin: 20px 0;
  font-size: 14px;
  line-height: 1.4;
  color: ${theme.colors.gray4};
`
