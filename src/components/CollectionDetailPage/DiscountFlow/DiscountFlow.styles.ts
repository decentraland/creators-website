import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { Note } from '../SellItemFlow/SellItemModal.styles'

export const Discounts = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
`

export const DiscountChip = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 4px 4px 4px 16px;
  border: 1px solid ${theme.colors.glassHover};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayLight};
  font-size: 14px;
  color: ${theme.colors.softWhite};

  & span {
    color: ${theme.colors.gray4};
    font-size: 13px;
  }

  ${theme.media.maxWidth('mobile')} {
    width: 100%;
    justify-content: space-between;
  }
`

export const DiscountTerms = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
`

export const TextButton = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: ${theme.colors.softWhite};
  text-decoration: underline;
  cursor: pointer;
`
