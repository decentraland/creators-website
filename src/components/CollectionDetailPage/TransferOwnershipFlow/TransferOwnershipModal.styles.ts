import styled from '@emotion/styled'
import { Body as RolesBody } from '../ManageRolesFlow/ManageRolesModal.styles'

export { Description } from '../ManageRolesFlow/ManageRolesModal.styles'
export { Field, Label, Box, Note } from '../SellItemFlow/SellItemModal.styles'

/** The warning closes the form, so it gets more room before the buttons than a field would. */
export const Body = styled(RolesBody)`
  padding-bottom: 16px;
`
