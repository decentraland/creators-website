import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 100px 0 80px;
  text-align: center;

  &[data-with-steps] {
    padding-top: 8px;
  }
`

export const Title = styled.h3`
  align-self: flex-start;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.6;
  color: ${theme.colors.softWhite};
`

export const Steps = styled.ol`
  display: flex;
  align-self: stretch;
  gap: 16px;
  margin: 0;
  padding: 16px;
  list-style: none;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayLight};
`

export const StepItem = styled.li`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray4};

  &[data-state='current'] {
    color: ${theme.colors.white};
  }
  &[data-state='done'] {
    color: ${theme.colors.softWhite};
  }
`

export const StepDot = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${theme.colors.glassHover};
  color: ${theme.colors.white};

  [data-state='current'] > & {
    border-color: ${theme.colors.dclRed};
  }
  [data-state='done'] > & {
    border-color: ${theme.colors.dclRed};
    background: ${theme.colors.dclRed};
  }

  & svg {
    font-size: 16px;
  }
`

export const BigSpinner = styled.span`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 8px solid ${theme.colors.overlayLight};
  border-top-color: ${theme.colors.dclRed};
  animation: spin 1s linear infinite;
`

export const Label = styled.p`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.white};
`

export const Note = styled.p`
  margin: -16px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const CancelLink = styled.button`
  border: 0;
  background: none;
  padding: 8px 16px;
  font: inherit;
  font-size: 18px;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`
