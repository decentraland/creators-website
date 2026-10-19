import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// The Shop's discount tag, drawn the same: a pink chip with a gradient hairline, a flame and the cut in bold.
export const Root = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 4px;
  /* A gradient hairline: the fill clipped to the padding box, the gradient to the border box. */
  background:
    linear-gradient(${theme.colors.saleTag}, ${theme.colors.saleTag}) padding-box,
    ${theme.gradients.flare} border-box;
  border: 0.5px solid transparent;
  color: ${theme.colors.text};
  font-size: 12px;
  font-weight: 400;
  line-height: 12px;
  white-space: nowrap;
`

export const Pct = styled.b`
  font-weight: 700;
  color: ${theme.colors.saleTagInk};
`
