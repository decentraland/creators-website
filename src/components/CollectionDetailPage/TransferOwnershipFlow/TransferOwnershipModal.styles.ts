import styled from '@emotion/styled'
import { Body as RolesBody } from '../ManageRolesFlow/ManageRolesModal.styles'

export { Description } from '../ManageRolesFlow/ManageRolesModal.styles'
export { Field, Label, Box, Note } from '../SellItemFlow/SellItemModal.styles'
export { Steps, Intro } from '../SendItemsFlow/SendItemsModal.styles'

/** The warning closes the confirm step, so it gets more room before the buttons than a field would. */
export const Body = styled(RolesBody)`
  padding-bottom: 16px;
`
