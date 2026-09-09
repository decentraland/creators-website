import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// minmax(0, 1fr) tracks so object-fit can shrink images instead of the intrinsic size blowing the grid.
export const Mosaic = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  background: ${theme.colors.media};
  overflow: hidden;

  &[data-count='1'] > * {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
  }
  &[data-count='2'] > * {
    grid-row: 1 / -1;
  }
  &[data-count='3'] > *:first-of-type {
    grid-row: 1 / -1;
  }
`

export const Cell = styled.div`
  min-width: 0;
  min-height: 0;
  border: 0.25px solid ${theme.colors.cardLine};
`

export const Loading = styled.div`
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  border-radius: 0;
`
