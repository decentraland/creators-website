import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const StepsBase = styled.ol`
  display: flex;
  align-items: center;
  list-style: none;
  padding: 0 4px;
`

export const StepNode = styled.li`
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;

  &:last-of-type {
    flex: none;
  }

  /* Connector to the next step; reached steps paint it red. */
  &::after {
    content: '';
    flex: 1;
    height: 3px;
    background: ${theme.colors.glassHover};
  }
  &:last-of-type::after {
    display: none;
  }
  &[data-reached]::after {
    background: ${theme.colors.dclRed};
  }
`

export const StepDot = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${theme.colors.glassHover};
  color: ${theme.colors.softWhite};
  font-size: 13px;
  font-weight: 600;

  &[data-state='done'] {
    background: ${theme.colors.dclRed};
    color: ${theme.colors.white};
  }
  &[data-state='current'] {
    background: ${theme.colors.white};
    color: ${theme.colors.text};
    border: 3px solid ${theme.colors.modalSurface};
    outline: 2px solid ${theme.colors.dclRed};
  }
`

// With labels the row needs room below the dots; the first and last labels hug the row's edges.
export const Steps = styled(StepsBase)`
  &[data-labelled] {
    padding-bottom: 32px;
  }
`

export const StepLabel = styled.span`
  position: absolute;
  top: 34px;
  font-size: 14px;
  line-height: 1.4;
  white-space: nowrap;
  color: ${theme.colors.gray4};

  &[data-align='start'] {
    left: 0;
  }
  &[data-align='center'] {
    left: 12px;
    transform: translateX(-50%);
  }
  &[data-align='end'] {
    right: 0;
  }

  [aria-current] > & {
    color: ${theme.colors.white};
  }
`
