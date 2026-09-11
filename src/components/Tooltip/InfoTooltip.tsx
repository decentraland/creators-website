import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material'
import type { ComponentProps } from 'react'
import { Tooltip } from './Tooltip'

type Props = Omit<ComponentProps<typeof Tooltip>, 'children' | 'asChild'>

/** The (i) glyph that opens a tooltip on hover, focus or tap. */
export function InfoTooltip(props: Props) {
  return (
    <Tooltip {...props}>
      <InfoOutlinedIcon sx={{ fontSize: 16 }} />
    </Tooltip>
  )
}
