import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// The shared button primitive (ported from shop). Base = the red primary CTA; colour variants ride on
// data-variant and sizes on data-size. Consumers add layout-only tweaks (width, margin) by wrapping with
// `styled(Button)`, never by re-declaring variants.
const enabled = ':not(:disabled):not([aria-disabled])'

export const Root = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  min-width: 180px;
  padding: 0 20px;
  border: 0;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.dclRed};
  color: ${theme.colors.white};
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0.46px;
  text-transform: uppercase;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover${enabled} {
    background: ${theme.colors.dclRedHover};
  }
  &:disabled,
  &[aria-disabled] {
    opacity: 0.5;
    cursor: default;
  }

  &[data-variant='gradient'] {
    background: ${theme.gradients.ember};
  }
  &[data-variant='gradient']:hover${enabled} {
    background: ${theme.colors.dclRed};
  }

  &[data-variant='secondary'] {
    background: none;
    border: 1px solid ${theme.colors.white};
    color: ${theme.colors.softWhite};
  }
  &[data-variant='secondary']:hover${enabled} {
    background: ${theme.colors.white};
    color: ${theme.colors.text};
  }

  &[data-variant='dark'] {
    background: ${theme.colors.overlay};
    color: ${theme.colors.softWhite};
  }
  &[data-variant='dark']:hover${enabled} {
    background: ${theme.colors.overlayHover};
  }

  &[data-size='sm'] {
    height: 36px;
    min-width: 0;
    padding: 0 12px;
  }
  &[data-size='icon'] {
    width: 46px;
    min-width: 0;
    padding: 0;
  }
`

export const Spinner = styled.span`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: ${theme.colors.white};
  animation: spin 0.8s linear infinite;
`
