import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Fills whatever box the caller sizes; the rarity wash comes in as an inline background-image.
// The single track is pinned to the frame so the image's percentage size resolves against the frame,
// not against a row that grew to the image's natural size.
export const Frame = styled.span`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  place-items: center;
  width: 100%;
  height: 100%;
  background-color: ${theme.colors.media};
  overflow: hidden;
`

// An 85% box in both axes with the artwork contained and centered inside it, whatever the frame's aspect.
export const Img = styled.img`
  width: 85%;
  height: 85%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(1px 4px 5px rgba(0, 0, 0, 0.1));
`
