// Styled primitives shared by more than one page (buttons, search box, state panels, list footer).
// Page-specific styles stay in each page's `.styles.ts`, which may re-export from here.
import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

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

export const Spinner = styled.span`
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: ${theme.colors.white};
  animation: spin 0.8s linear infinite;
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
