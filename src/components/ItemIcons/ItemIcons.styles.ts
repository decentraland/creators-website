import styled from '@emotion/styled'

// Monochrome SVG glyphs (shop's icon set) painted as CSS masks so they take the text color.
export const MaskIcon = styled.span`
  display: inline-block;
  flex: none;
  width: 20px;
  height: 20px;
  background-color: currentColor;
  -webkit-mask: var(--icon-url) center / contain no-repeat;
  mask: var(--icon-url) center / contain no-repeat;
  vertical-align: middle;
`

export const Labeled = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;

  & > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`
