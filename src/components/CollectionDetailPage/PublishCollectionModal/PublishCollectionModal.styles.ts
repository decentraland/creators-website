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
  overflow: hidden;
`

// Everything but the footer; while the wallet prompt is pending it goes inert and dims like the add-items upload.
export const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;

  &[data-busy] {
    pointer-events: none;
    opacity: 0.7;
  }
`

export const Steps = styled.ol`
  display: flex;
  align-items: center;
  list-style: none;
  padding: 0 4px;
`

export const StepNode = styled.li`
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;

  &:last-of-type {
    flex: none;
  }

  /* Connector to the next step; reached steps paint it red. */
  &::after {
    content: '';
    flex: 1;
    height: 3px;
    background: ${theme.colors.glassHover};
  }
  &:last-of-type::after {
    display: none;
  }
  &[data-reached]::after {
    background: ${theme.colors.dclRed};
  }
`

export const StepDot = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${theme.colors.glassHover};
  color: ${theme.colors.softWhite};
  font-size: 13px;
  font-weight: 600;

  &[data-state='done'] {
    background: ${theme.colors.dclRed};
    color: ${theme.colors.white};
  }
  &[data-state='current'] {
    background: ${theme.colors.white};
    color: ${theme.colors.text};
    border: 3px solid ${theme.colors.modalSurface};
    outline: 2px solid ${theme.colors.dclRed};
  }
`

export const Heading = styled.h3`
  margin: auto 0 16px;
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
  padding-bottom: 32px;
  margin: 32px 0 auto;
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
  cursor: pointer;
  padding-left: 12px;

  /* Visually hidden but still the real, clickable control (no pointer-events: none). */
  & input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    opacity: 0;
  }

  & a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: ${theme.colors.dclRed};
    }
  }

  &[data-disabled] {
    opacity: 0.6;
    cursor: default;
  }
`

export const CheckboxBox = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 1.5px solid ${theme.colors.gray4};
  border-radius: 4px;
  color: ${theme.colors.white};
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  & svg {
    font-size: 16px;
    opacity: 0;
  }

  input:checked + & {
    border-color: ${theme.colors.dclRed};
    background: ${theme.colors.dclRed};

    & svg {
      opacity: 1;
    }
  }
  input:focus-visible + & {
    box-shadow: 0 0 0 2px ${theme.colors.glassLine};
  }
`

export const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 0.5px solid ${theme.colors.glassHover};

  & > * {
    min-width: 250px;
  }
`

export const Table = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: auto;
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
  background: ${theme.colors.media};
  overflow: hidden;

  & img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
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
