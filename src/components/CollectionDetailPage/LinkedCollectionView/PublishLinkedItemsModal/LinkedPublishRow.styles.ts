import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const COLUMNS = 'minmax(0, 2fr) minmax(110px, 1fr) minmax(140px, 1.2fr)'

export const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLUMNS};
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlay};
  font-size: 13px;
  color: ${theme.colors.softWhite};

  & > span {
    display: flex;
    justify-content: center;
    min-width: 0;
  }
`

export const Name = styled.span`
  && {
    justify-content: flex-start;
    gap: 12px;
    font-weight: 600;

    & > span:last-of-type {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`

export const KindCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
`

export const KindCard = styled.button`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border: 2px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlay};
  color: ${theme.colors.softWhite};
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: ${theme.colors.white};
  }
  &[data-selected] {
    border-color: ${theme.colors.white};
    background: ${theme.colors.overlayStrong};
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
`

export const KindTitle = styled.span`
  font-size: 16px;
  font-weight: 700;
`

export const KindText = styled.span`
  font-size: 13px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const KindPrice = styled.span`
  margin-top: auto;
  font-size: 14px;
  font-weight: 700;
`
