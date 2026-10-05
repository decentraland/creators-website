import styled from '@emotion/styled'

// A full-viewport, non-interactive layer for the burst: it rains over whatever dialog mounts it and can
// never swallow a click on the button underneath.
export const Layer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
`
