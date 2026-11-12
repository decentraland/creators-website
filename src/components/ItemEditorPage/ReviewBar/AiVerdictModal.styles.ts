import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
`

export const Headline = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: ${theme.colors.redBright};

  &[data-passed='true'] {
    color: ${theme.colors.green};
  }
`

export const Summary = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${theme.colors.gray4};
`

export const ValidationId = styled.p`
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: ${theme.colors.gray4};
  overflow-wrap: anywhere;
`

export { ModalActions as Actions } from '~/styles/shared'
