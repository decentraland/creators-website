import styled from '@emotion/styled'
import { Button } from '~/components/Button'
import { theme } from '~/styles/theme'

// Closes the preview's bottom bar on the right, away from the playback controls; the explorer is
// desktop-only, so narrow screens would only be sent to the download page.
export const Launch = styled(Button)`
  height: 48px;
  margin-left: auto;
  border: 1px solid ${theme.editor.line};

  ${theme.media.noActions} {
    display: none;
  }
`
