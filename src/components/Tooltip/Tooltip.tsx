import styled from '@emotion/styled'
import { Tooltip as UiTooltip } from 'decentraland-ui2'
import type { ComponentProps, ReactNode } from 'react'
import { theme } from '~/styles/theme'
import * as S from './Tooltip.styles'

type Props = {
  content: ReactNode
  /** The icon or glyph that opens the tooltip on hover, focus or tap. */
  children: ReactNode
  placement?: UiTooltipProps['placement']
  testId?: string
}

type UiTooltipProps = ComponentProps<typeof UiTooltip>

// MUI applies `className` to the trigger, so route it to the portalled popper to style the bubble.
const Popper = styled(({ className, ...props }: UiTooltipProps) => (
  <UiTooltip {...props} classes={{ popper: className }} />
))`
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

export function Tooltip({ content, children, testId = 'tooltip', placement = 'top' }: Props) {
  return (
    <Popper
      arrow
      title={<span data-testid={testId}>{content}</span>}
      enterDelay={0}
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      placement={placement}
    >
      <S.Trigger type="button" data-testid={`${testId}-trigger`}>
        {children}
      </S.Trigger>
    </Popper>
  )
}
