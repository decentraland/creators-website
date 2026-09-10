import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
  cursor: pointer;

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
