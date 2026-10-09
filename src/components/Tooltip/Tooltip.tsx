import styled from '@emotion/styled'
import { Tooltip as UiTooltip } from 'decentraland-ui2'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { theme } from '~/styles/theme'
import * as S from './Tooltip.styles'

type Props = {
  /** Nothing to say (null) renders the children alone. */
  content: ReactNode
  /** The icon or glyph that opens the tooltip on hover, focus or tap; with `asChild`, the trigger element itself. */
  children: ReactNode
  /** Use the child as the trigger instead of wrapping it: it must be a single element that forwards its ref. */
  asChild?: boolean
  placement?: UiTooltipProps['placement']
  /** The tooltip describes the trigger instead of naming it, so its visible label stays its accessible name. */
  describeChild?: boolean
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

export function Tooltip({
  content,
  children,
  asChild = false,
  describeChild = false,
  testId = 'tooltip',
  placement = 'top'
}: Props) {
  const empty = content === null || content === undefined || content === false
  // A trigger of its own keeps its wrapper while there is nothing to say, so content arriving later does not
  // remount it (and drop its focus); MUI renders no tooltip for an empty title.
  if (empty && !asChild) return <>{children}</>
  return (
    <Popper
      arrow
      describeChild={describeChild}
      title={empty ? '' : <S.Content data-testid={testId}>{content}</S.Content>}
      enterDelay={0}
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      placement={placement}
    >
      {asChild ? (
        (children as ReactElement)
      ) : (
        <S.Trigger type="button" data-testid={`${testId}-trigger`}>
          {children}
        </S.Trigger>
      )}
    </Popper>
  )
}
