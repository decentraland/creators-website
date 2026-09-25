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
    background: ${theme.gradients.coral};
  }
  &[data-variant='gradient']:hover${enabled} {
    transition: none;
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

  /* The sites landing recipes below (MUI medium, the FAQ "see more" and the hero download CTA). */
  &[data-variant='light'] {
    border: 1px solid ${theme.colors.dclRedLine};
    background: ${theme.colors.white};
    color: ${theme.colors.gray0};
  }
  &[data-variant='light']:hover${enabled} {
    background: ${theme.colors.media};
  }

  &[data-variant='ghost'] {
    border: 1px solid ${theme.colors.offWhite};
    background: none;
    color: ${theme.colors.offWhite};
  }
  &[data-variant='ghost']:hover${enabled} {
    background: ${theme.colors.glassHint};
  }

  &[data-size='compact'] {
    height: 36px;
    min-width: 64px;
    padding: 0 16px;
    border-radius: ${theme.radius.input};
    font-size: 14px;
    letter-spacing: 0.4px;
  }
  &[data-size='compact'][data-variant='light'] {
    padding: 0 15px;
  }

  &[data-size='lg'] {
    height: auto;
    min-width: 0;
    padding: 24px 64px;
    border-radius: ${theme.radius.input};
    font-size: 15px;
    line-height: 1.5;
    letter-spacing: ${theme.font.tracking};
  }

  &[data-size='hero'] {
    position: relative;
    height: auto;
    min-width: 0;
    padding: 24px 48px;
    border-radius: ${theme.radius.input};
    font-size: 19.89px;
    line-height: 31.82px;
    letter-spacing: 0.61px;
  }
  &[data-size='hero']:hover${enabled} {
    background: ${theme.colors.dclRed};
  }
  /* A white ring that grows out of the edge on hover. */
  &[data-size='hero']::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 4px solid ${theme.colors.white};
    border-radius: 14px;
    opacity: 0;
    transition:
      inset 0.2s ease-in-out,
      opacity 0.2s ease-in-out;
  }
  &[data-size='hero']:hover${enabled}::before {
    inset: -7.5px;
    opacity: 1;
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
