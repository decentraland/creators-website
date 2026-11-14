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
    color: ${theme.colors.errorText};

    & > p > svg {
      color: ${theme.colors.errLight};
    }
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

export const RequestNote = styled.div`
  width: 100%;
  margin-top: 20px;
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

export const Attempts = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.gray4};
`

export const LimitAttempts = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 12px;
`

export const CommentCount = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: default;
`
