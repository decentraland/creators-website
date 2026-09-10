import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Fills whatever box the caller sizes; the rarity wash comes in as an inline background-image.
export const Frame = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
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
