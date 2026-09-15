import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Zone = styled.div`
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

  &[data-compact] {
    min-height: 140px;
    padding: 20px;
  }

  &[data-dragging] {
    border-color: ${theme.colors.white};
    background: ${theme.colors.glass};
  }

  &[data-busy] > :not([data-spinner]) {
    opacity: 0.5;
    pointer-events: none;
  }

  &[data-empty] > svg {
    width: 32px;
    height: 32px;
    color: ${theme.colors.gray4};
  }

  /* Filled: the caller's card, still a drop target for a replacement. */
  &:not([data-empty]) {
    flex-direction: row;
    align-items: stretch;
    gap: 16px;
    padding: 12px;
    border-style: solid;
    border-color: ${theme.colors.glassFaint};
    text-align: left;
  }

  ${mobile} {
    min-height: 200px;
    padding: 24px 16px;

    [data-desktop] {
      display: none;
    }
  }
`

export const DropText = styled.span`
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const Hint = styled.span`
  font-size: 12px;
  font-weight: 400;
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

  &:hover,
  &:focus-visible {
    color: ${theme.colors.gray4};
  }
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

export const ErrorText = styled.p`
  margin: 8px 0 0;
  font-size: 13px;
  color: ${theme.colors.errStrong};
`
