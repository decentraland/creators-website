import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { Spinner as SharedSpinner } from '~/styles/shared'

const { colors, radius, media } = theme
const mobile = media.maxWidth('mobile')

export const Row = styled.li`
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto 40px;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: ${radius.card};
  background: ${colors.glassFaint};
  border: 1px solid ${colors.cardLine};

  ${mobile} {
    grid-template-columns: 32px minmax(0, 1fr) 40px;
    gap: 12px;
    padding: 12px;
  }
`

export const Icon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${radius.pill};
  background: ${colors.glass};
  color: ${colors.white};

  ${mobile} {
    width: 32px;
    height: 32px;
  }
`

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

export const Text = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  color: ${colors.white};
  overflow-wrap: anywhere;

  & a {
    color: ${colors.white};
    font-weight: 600;
    text-decoration: underline;
  }
  & a:hover {
    color: ${colors.amber};
  }
`

export const Meta = styled.div`
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: ${colors.gray4};
`

export const Status = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px;
  border-radius: ${radius.pill};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  background: ${colors.glass};
  color: ${colors.white};

  &[data-status='confirmed'] {
    background: rgba(48, 205, 0, 0.2);
    color: ${colors.green};
  }
  &[data-status='reverted'] {
    background: rgba(204, 29, 44, 0.2);
    color: ${colors.redBright};
  }
  &[data-status='pending'] {
    background: rgba(244, 130, 33, 0.2);
    color: ${colors.amber};
  }
  &[data-status='dropped'] {
    color: ${colors.gray4};
  }

  ${mobile} {
    grid-column: 2;
    justify-self: start;
    height: 24px;
    font-size: 11px;
  }
`

export const Spinner = styled(SharedSpinner)`
  width: 12px;
  height: 12px;
  border-width: 2px;
`

export const ExplorerButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: ${radius.pill};
  background: transparent;
  color: ${colors.gray4};
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${colors.glass};
    color: ${colors.white};
  }

  ${mobile} {
    grid-column: 3;
    grid-row: 1;
  }
`
