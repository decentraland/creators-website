import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { Form, Intro, Heading, Subtitle, Actions } from '~/components/CollectionNameModal/CollectionNameModal.styles'

export const Preview = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.gray4};
  overflow-wrap: anywhere;

  strong {
    color: ${theme.colors.white};
  }
`
