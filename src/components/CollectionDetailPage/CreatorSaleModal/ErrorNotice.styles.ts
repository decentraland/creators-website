import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// The Shop's inline error banner (its global `.error-notice`), as a local styled block.
export const Notice = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(221, 51, 51, 0.25);
  border-radius: 8px;
  background: rgba(221, 51, 51, 0.08);
  color: ${theme.colors.err};
  font-size: 14px;
  line-height: 1.4;
  text-align: left;

  & > svg {
    flex: none;
    width: 18px;
    height: 18px;
  }
`

export const Message = styled.span`
  color: ${theme.colors.text2};
`
