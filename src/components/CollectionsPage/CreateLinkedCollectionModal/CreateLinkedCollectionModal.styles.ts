import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { Spinner as SharedSpinner } from '~/styles/shared'

export { Form, Intro, Heading, Subtitle, Actions } from '~/components/CollectionNameModal/CollectionNameModal.styles'

export const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`

export const LearnMore = styled.a`
  color: ${theme.colors.white};
  text-decoration: underline;
  white-space: nowrap;
`

export const Spinner = styled(SharedSpinner)`
  flex: none;
  width: 18px;
  height: 18px;
`
