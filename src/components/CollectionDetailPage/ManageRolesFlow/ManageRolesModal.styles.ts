import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import * as Send from '../SendItemsFlow/SendItemsModal.styles'

export { Body } from '../SendItemsFlow/SendItemsModal.styles'

export const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled.li`
  display: flex;

  & > * {
    flex: 1;
    min-width: 0;
  }
`

export const LinkButton = styled(Send.LinkButton)`
  margin-left: 0;
`
