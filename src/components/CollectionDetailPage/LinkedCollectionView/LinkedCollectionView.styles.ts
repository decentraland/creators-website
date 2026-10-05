import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const ContractRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 32px;
  margin-bottom: 24px;
  padding: 16px 24px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};

  ${mobile} {
    padding: 12px 16px;
    gap: 8px 24px;
  }
`

export const ContractField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const ContractLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  text-transform: uppercase;
  color: ${theme.colors.offWhiteMuted};
`

export const ContractValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.57;
  color: ${theme.colors.softWhite};
`

export const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px -10px -10px 0;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: inherit;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.glassFaint};
  }
`

export const ItemCount = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  color: ${theme.colors.softWhite};
`

// The statuses failed to load (unexpected: builder-server's "nothing submitted yet" already reads as Not published).
export const StatusRetry = styled.button`
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: ${theme.colors.softWhite};
  font: inherit;
  text-decoration: underline;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }
`
