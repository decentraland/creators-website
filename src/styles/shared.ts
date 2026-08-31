// Styled primitives shared by more than one page (buttons, search box, state panels, list footer).
// Page-specific styles stay in each page's `.styles.ts`, which may re-export from here.
import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 46px;
  min-width: 180px;
  padding: 0 12px;
  border-radius: ${theme.radius.btn};
  border: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0.46px;
  text-transform: uppercase;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &[data-variant='primary'] {
    background: ${theme.colors.dclRed};
    color: ${theme.colors.white};

    &:hover {
      background: ${theme.colors.dclRedHover};
    }
  }
  &[data-variant='secondary'] {
    background: none;
    border: 0.5px solid ${theme.colors.white};
    color: ${theme.colors.softWhite};

    &:hover {
      background: ${theme.colors.glassFaint};
    }
  }
  &[aria-disabled],
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`

export const ActionLink = ActionButton.withComponent('a')

export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  width: 450px;
  max-width: 100%;
  padding: 7px 12px;
  border: 1px solid ${theme.colors.fieldBorder};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.gray4};

  &:focus-within {
    border-color: ${theme.colors.white};
  }

  & input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    font: inherit;
    font-size: 17px;
    letter-spacing: -0.2px;
    color: ${theme.colors.white};

    &::placeholder {
      color: ${theme.colors.gray4};
    }
  }
`

// Shared shell for the sign-in / empty / error / no-results states.
export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 150px 24px;
  border-radius: ${theme.radius.banner};
  background: ${theme.colors.overlayLight};
  text-align: center;

  ${mobile} {
    gap: 20px;
    padding: 48px 20px;
  }
`

export const PanelTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.46px;
  color: ${theme.colors.white};

  ${mobile} {
    font-size: 18px;
  }
`

export const PanelText = styled.p`
  margin: -20px 0 0;
  max-width: 640px;
  font-size: 16px;
  line-height: 1.6;
  color: ${theme.colors.softWhite};

  &[data-mobile] {
    display: none;
  }

  ${mobile} {
    margin-top: -8px;
    font-size: 14px;

    &[data-desktop] {
      display: none;
    }
    &[data-mobile] {
      display: block;
    }
  }
`

export const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  ${mobile} {
    flex-direction: column;
    align-items: center;
  }
`

export const ShowingCount = styled.span`
  font-size: 14px;
  line-height: 1.57;
  color: ${theme.colors.gray4};
`
