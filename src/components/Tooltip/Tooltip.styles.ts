import styled from '@emotion/styled'
import { Tooltip as UiTooltip } from 'decentraland-ui2'
import { createElement, type ComponentProps } from 'react'
import { theme } from '~/styles/theme'

export type UiTooltipProps = ComponentProps<typeof UiTooltip>

// MUI applies `className` to the trigger, so route it to the portalled popper to style the bubble.
export const Popper = styled(({ className, ...props }: UiTooltipProps) =>
  createElement(UiTooltip, { ...props, classes: { popper: className } })
)`
  z-index: ${theme.z.tooltip};

  .MuiTooltip-tooltip {
    max-width: min(320px, calc(100vw - 32px));
    padding: 10px 12px;
    border-radius: ${theme.radius.btnSm};
    background: ${theme.colors.text2};
    color: ${theme.colors.white};
    font-family: ${theme.font.sans};
    font-size: 13px;
    font-weight: 400;
    line-height: 1.4;
    white-space: pre-line;
    box-shadow: 0 8px 24px ${theme.colors.overlayStrong};
  }

  .MuiTooltip-arrow {
    color: ${theme.colors.text2};
  }
`

export const Trigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  border-radius: ${theme.radius.chip};

  &:focus-visible {
    outline: 2px solid ${theme.colors.glassHover};
    outline-offset: 2px;
  }
`

export const Content = styled.span`
  color: ${theme.colors.softWhite};
  font-size: 16px;
`
