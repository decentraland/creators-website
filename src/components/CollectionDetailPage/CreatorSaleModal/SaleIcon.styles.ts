import styled from '@emotion/styled'

// The Shop's `.ico` base: a 20px glyph that never shrinks. The modal's styles resize it through the `ico` class.
export const Svg = styled.svg`
  display: inline-block;
  flex: none;
  width: 20px;
  height: 20px;
`

// The Shop's credits mark: a mask tinted with currentColor, `ccy-mark` sizing it to the text around it.
export const Mark = styled.span`
  display: inline-block;
  flex: none;
  width: 20px;
  height: 20px;
  background-color: currentColor;
  -webkit-mask: var(--icon-url) center / contain no-repeat;
  mask: var(--icon-url) center / contain no-repeat;

  &.ccy-mark {
    width: 1em;
    height: 1em;
    vertical-align: -0.125em;
  }
`
