import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const Tabs = styled.div`
  display: flex;
  gap: 4px;
`

export const Tab = styled.button`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.chip};
  background: transparent;
  color: ${theme.colors.white};
  font: inherit;
  font-size: 13px;

  &[aria-selected='true'] {
    border-color: ${theme.editor.accent};
    background: ${theme.editor.surfaceHover};
  }
`

export const Counter = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.chipDark};
  font-size: 11px;
  color: ${theme.editor.label};

  &[data-over] {
    color: ${theme.colors.errLight};
  }
`

export const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.chip};
  background: ${theme.editor.bg};
`

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.white};

  & > span:first-of-type {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const Param = styled.label`
  display: grid;
  grid-template-columns: 1fr 64px;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 8px;
  row-gap: 4px;
  font-size: 12px;
  color: ${theme.editor.label};

  & > span {
    grid-column: 1 / -1;
  }

  & input[type='range'] {
    width: 100%;
    height: 16px;
    margin: 0;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }

  & input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: ${theme.radius.chip};
    background: linear-gradient(
      to right,
      ${theme.editor.accent} var(--fill, 0%),
      ${theme.colors.muted} var(--fill, 0%)
    );
  }
  & input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: ${theme.radius.chip};
    background: ${theme.colors.muted};
  }
  & input[type='range']::-moz-range-progress {
    height: 4px;
    border-radius: ${theme.radius.chip};
    background: ${theme.editor.accent};
  }

  & input[type='range']::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border: 0;
    border-radius: 50%;
    background: ${theme.editor.accent};
    appearance: none;
  }
  & input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 0;
    border-radius: 50%;
    background: ${theme.editor.accent};
  }

  & input[type='range']:disabled {
    cursor: default;
    opacity: 0.5;
  }
`

export const NumberInput = styled.input`
  width: 100%;
  min-height: 28px;
  padding: 0 6px;
  border: 1px solid ${theme.editor.line};
  border-radius: ${theme.radius.chip};
  background: ${theme.editor.surface};
  color: ${theme.colors.white};
  font: inherit;
  font-size: 12px;

  &:disabled {
    opacity: 0.5;
  }
`

export const Vector = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  & label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: ${theme.editor.label};
  }
`

export const AddRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`
