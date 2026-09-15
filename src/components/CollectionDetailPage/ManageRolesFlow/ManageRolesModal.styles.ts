import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Body = styled.div`
  flex: 1;
  /* Without min-height:0 a flex child won't shrink below its content, so the overflow never scrolls. */
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 4px 8px 0;

  &[data-busy] {
    opacity: 0.6;
  }
`

export const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled.li`
  display: flex;

  & > * {
    flex: 1;
    min-width: 0;
  }
`

export const LinkButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
    text-decoration: none;
  }

  & > svg {
    font-size: 16px;
  }
`
