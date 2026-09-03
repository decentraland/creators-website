import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

// Figma "Rarity Label": fill = rarity color @ 33%, border/text = the rarity's light gradient stop.
export const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${theme.radius.pill};
  border: 0.5px solid var(--rarity-light, ${theme.colors.gray4});
  background: color-mix(in srgb, var(--rarity-color, ${theme.colors.gray4}) 33%, transparent);
  color: var(--rarity-light, ${theme.colors.gray4});
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-transform: uppercase;
  white-space: nowrap;

  &[data-size='large'] {
    padding: 4px 12px;
    font-size: 15px;
    line-height: 22px;
  }
`
