import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { Body } from '../SendItemsFlow/SendItemsModal.styles'
export { Field, Label, Box, ErrorText, Note } from '../SellItemFlow/SellItemModal.styles'

export const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray4};

  & b {
    color: ${theme.colors.softWhite};
    font-weight: 600;
  }
`
