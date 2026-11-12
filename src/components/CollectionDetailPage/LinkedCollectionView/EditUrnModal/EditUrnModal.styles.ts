import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

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
