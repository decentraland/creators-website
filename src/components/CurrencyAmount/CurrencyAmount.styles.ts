import styled from '@emotion/styled'

// Currency glyphs (credits "C", MANA diamond) sized to the surrounding text.
export const Mark = styled.span`
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  -webkit-mask: var(--icon-url) center / contain no-repeat;
  mask: var(--icon-url) center / contain no-repeat;
`
