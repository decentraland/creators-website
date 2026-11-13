import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Notice = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 14px;
  line-height: 1.43;

  &[data-tone='info'] {
    background: rgba(23, 100, 192, 0.25); /* info @ 25% */
    color: ${theme.colors.infoLighter};
  }

  &[data-tone='error'] {
    background: ${theme.colors.errorOverlay};
    color: ${theme.colors.errLight};
  }
`

export const NoticeText = styled.p`
  display: flex;
  flex: 1 1 320px;
  align-items: center;
  gap: 8px;
  margin: 0;

  & svg {
    flex: none;
  }
`

export const NoticeSpinner = styled.span`
  flex: none;
  width: 18px;
  height: 18px;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2s;
  }
`

export const NoticeActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  ${mobile} {
    width: 100%;

    & > * {
      flex: 1 1 auto;
      min-height: 44px;
    }
  }
`

export const SeeIssues = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  min-height: 24px;
`

export const Attempts = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.gray4};
`

export const NoticeDetails = styled.div`
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  gap: 8px;
  order: 3;
  min-width: 0;
`

export const Reasons = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Reason = styled.li`
  padding: 2px 10px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.glass};
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.softWhite};
`

export const QuoteLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
`

export const Quote = styled.blockquote`
  margin: 0;
  padding: 8px 12px;
  border-left: 3px solid currentColor;
  color: ${theme.colors.softWhite};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`
