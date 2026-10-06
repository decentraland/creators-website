import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const Face = styled.img`
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: ${theme.colors.glassHover};
`

export const FaceFallback = styled.span`
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${theme.gradients.amethyst};
`

export const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const You = styled.span`
  flex: none;
  color: ${theme.colors.gray4};
  font-weight: 400;
`
