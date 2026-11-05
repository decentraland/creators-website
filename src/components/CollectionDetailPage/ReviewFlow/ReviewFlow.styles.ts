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

export const Attempts = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.gray4};
`
