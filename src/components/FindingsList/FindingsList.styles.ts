import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Finding = styled.li`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlayLight};
  font-size: 14px;
  line-height: 1.43;
  color: ${theme.colors.softWhite};

  &[data-severity='error'] {
    border-left: 3px solid ${theme.colors.redBright};
  }
  &[data-severity='warning'] {
    border-left: 3px solid ${theme.colors.amber};
  }
`

export const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
`

export const Severity = styled.span`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;

  &[data-severity='error'] {
    color: ${theme.colors.redBright};
  }
  &[data-severity='warning'] {
    color: ${theme.colors.amber};
  }
`

export const Rule = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray4};
`

export const Where = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray4};
  overflow-wrap: anywhere;
`

export const Message = styled.p`
  margin: 0;
  overflow-wrap: anywhere;
`

export const Meta = styled.p`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const Fix = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.gray4};

  & strong {
    color: ${theme.colors.softWhite};
    font-weight: 600;
  }
`

export const DocsLink = styled.a`
  font-size: 12px;
  color: ${theme.colors.infoLighter};
  text-decoration: underline;
`

export const ItemGroup = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const ItemHead = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const ItemThumb = styled.img`
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: ${theme.colors.overlay};
  object-fit: cover;
`

export const ItemStatus = styled.span`
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;

  &[data-passed='true'] {
    color: ${theme.colors.green};
  }
  &[data-passed='false'] {
    color: ${theme.colors.redBright};
  }
  &[data-passed='null'] {
    color: ${theme.colors.amber};
  }
`

export const Summary = styled.p`
  margin: 0;
  padding: 10px 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlayLight};
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
  white-space: pre-wrap;
`

export const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`
