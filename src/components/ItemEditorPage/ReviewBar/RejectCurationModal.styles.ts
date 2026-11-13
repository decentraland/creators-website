import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 8px;
`

export const Heading = styled.h3`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const Label = styled.span`
  font-size: 14px;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
`

export const Pills = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
`

export const Pill = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 8px;
  border-radius: ${theme.radius.chip};
  background: ${theme.colors.overlay};
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.softWhite};
`

export const PillRemove = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: 16px;
  cursor: pointer;

  /* A 44px touch target around the small glyph. */
  &::after {
    content: '';
    position: absolute;
    inset: -14px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`

export const Details = styled.fieldset`
  /* 48px from the reasons, on top of the form's 24px gap. */
  margin: 24px 0 0;
  padding: 0 12px 12px;
  min-width: 0;
  border: 1px solid ${theme.colors.muted2};
  border-radius: ${theme.radius.input};

  &:focus-within {
    border-color: ${theme.colors.white};
  }
`

export const DetailsLegend = styled.legend`
  padding: 0 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.15px;
  text-transform: uppercase;
  color: ${theme.colors.muted2};
`

export const TextArea = styled.textarea`
  display: block;
  width: 100%;
  min-height: 180px;
  padding: 8px 0 0;
  border: 0;
  background: none;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;

  &::placeholder {
    color: ${theme.colors.muted2};
  }
  &:focus {
    outline: 0;
  }
  &:disabled {
    opacity: 0.6;
  }
`

export const CharCount = styled.span`
  align-self: flex-end;
  margin-top: -16px;
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const Error = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${theme.colors.errLight};
`

export { ModalActions as Actions } from '~/styles/shared'
