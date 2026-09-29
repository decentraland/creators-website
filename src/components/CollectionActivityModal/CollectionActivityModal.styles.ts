import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
`

export const Timeline = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Row = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 16px;
  padding: 12px 0;
  border-bottom: 1px solid ${theme.colors.glassFaint};

  &:last-child {
    border-bottom: 0;
  }

  ${mobile} {
    grid-template-columns: 1fr;
  }
`

export const Line = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  font-size: 15px;
  line-height: 1.4;
  color: ${theme.colors.softWhite};
`

export const Actor = styled.span`
  font-weight: 600;
  color: ${theme.colors.white};
`

export const Time = styled.time`
  font-size: 13px;
  color: ${theme.colors.gray4};
  white-space: nowrap;

  ${mobile} {
    grid-row: 1;
  }
`

export const Details = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
`

export const Reasons = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Reason = styled.li`
  padding: 2px 10px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.glass};
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.softWhite};
`

export const Quote = styled.blockquote`
  margin: 0;
  padding: 8px 12px;
  border-left: 3px solid ${theme.colors.glassLine};
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const Mono = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: ${theme.colors.gray4};
  overflow-wrap: anywhere;
`

export const Toggle = styled.button`
  align-self: flex-start;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  color: ${theme.colors.infoLighter};
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
`

export const State = styled.p`
  margin: 0;
  padding: 32px 0;
  text-align: center;
  font-size: 15px;
  color: ${theme.colors.gray4};
`

export const StateActions = styled.div`
  display: flex;
  justify-content: center;
`

export const SkeletonRow = styled.div`
  height: 52px;
  border-radius: ${theme.radius.btnSm};
`

export const More = styled.div`
  display: flex;
  justify-content: center;
`
