import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Editor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;

  &[data-compact] {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
`

export const TypeCell = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const COMPACT_TOKEN_ID_WIDTH = '104px'

export const Input = styled.input`
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: 8px;
  background: ${theme.colors.glassFaint};
  font: inherit;
  font-size: 14px;
  color: ${theme.colors.white};
  resize: vertical;

  &::placeholder {
    color: ${theme.colors.offWhiteMuted};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: -1px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &[data-invalid] {
    border-color: ${theme.colors.errLight};
    background: ${theme.colors.errOverlay};
  }

  [data-compact] > & {
    flex: 1 1 140px;
  }

  /* One token id and each bound of a range share one fixed width, so the column lines up whatever the type. */
  [data-compact] > &[data-size='short'],
  [data-compact] [data-range] > & {
    flex: none;
    width: ${COMPACT_TOKEN_ID_WIDTH};
  }

  [data-tone='dark'] & {
    background: ${theme.colors.chipDark};
    border-color: ${theme.colors.gray0};
  }

  /* Full-size on the default surface (the add-items form): the same box as that form's other text fields. */
  [data-tone='default']:not([data-compact]) & {
    min-height: 56px;
    padding: 0 12px;
    border-color: ${theme.colors.muted2};
    border-radius: ${theme.radius.input};
    background: transparent;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: ${theme.colors.softWhite};

    &::placeholder {
      color: ${theme.colors.muted2};
      font-weight: 600;
    }

    &:focus-visible {
      outline: 0;
      border-color: ${theme.colors.white};
    }

    &[data-invalid] {
      border-color: ${theme.colors.errStrong};
      background: transparent;
    }
  }

  [data-tone='default']:not([data-compact]) textarea& {
    padding: 16px 12px;
  }
`

export const RangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  [data-compact] > & {
    flex: none;
  }
`

export const RangeDash = styled.span`
  flex: none;
  color: ${theme.colors.offWhiteMuted};
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const Help = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;

  strong {
    margin-bottom: 4px;
  }
`
