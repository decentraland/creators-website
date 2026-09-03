import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const PreviewArea = styled.div`
  position: relative;
  width: min(700px, calc(100vh - 260px));
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: ${theme.radius.cardLg};
  background: ${theme.colors.media};
  overflow: hidden;

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  /* ui2 positions these itself (top/left and bottom/full-width); only override what moves them. */
  .zoom-controls {
    left: auto;
    right: 12px;
  }

  .emote-controls {
    box-sizing: border-box;
  }
`

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 16px;
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.errStrong};
`
