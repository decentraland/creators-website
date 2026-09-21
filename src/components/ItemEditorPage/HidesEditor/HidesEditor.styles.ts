import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const Label = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: ${theme.editor.label};
`

export const Empty = styled.span`
  font-size: 13px;
  color: ${theme.editor.label};
`
