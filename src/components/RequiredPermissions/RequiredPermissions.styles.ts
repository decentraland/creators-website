import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const Title = styled.span`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: ${theme.colors.softWhite};
  font-size: 14px;
`

export const DocsLink = styled.a`
  color: ${theme.colors.gray4};
  text-decoration: underline;

  &:hover {
    color: ${theme.colors.white};
  }
`

export const List = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Chip = styled.li`
  padding: 4px 10px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.softWhite};
  text-transform: capitalize;
`

export const Empty = styled.span``
