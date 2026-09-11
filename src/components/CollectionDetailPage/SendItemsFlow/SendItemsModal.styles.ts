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
  /* Keeps the scrollbar off the cards and lets the last one clear the footer. */
  padding: 4px 4px 8px 0;

  &[data-busy] {
    opacity: 0.6;
  }
`

export const Steps = styled.div`
  padding: 8px 0 4px;
`

export const Intro = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.white};
`

export const Transfer = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlayLight};
`

export const TransferHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const RemoveTransfer = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: ${theme.colors.gray4};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
  }
`

export const Recipients = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Recipient = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;

  & > :last-child {
    flex: 1;
    min-width: 0;
  }
`

export const Index = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.glassLine};
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const LinkButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  min-height: 44px;
  margin-left: 32px;
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

export const Label = styled.span`
  font-size: 13px;
  color: ${theme.colors.gray4};
`

export const Items = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`

export const ItemRow = styled.li`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid ${theme.colors.glassHover};

  &[data-disabled] {
    opacity: 0.5;
  }
`

export const Thumb = styled.div`
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: ${theme.radius.btnSm};
  overflow: hidden;

  & > * {
    width: 100%;
    height: 100%;
  }
`

export const ItemText = styled.div`
  flex: 1;
  min-width: 90px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const ItemName = styled.span`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const Stepper = styled.div`
  display: inline-flex;
  align-items: stretch;
  flex: none;
  height: 36px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.btnSm};
  overflow: hidden;

  & > button {
    width: 36px;
    border: 0;
    background: ${theme.colors.glassFaint};
    color: ${theme.colors.white};
    cursor: pointer;

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
    & > svg {
      font-size: 18px;
      vertical-align: middle;
    }
  }

  & > output {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.white};
  }
`

export const Amount = styled.span`
  flex: none;
  min-width: 24px;
  text-align: right;
  font-size: 15px;
  font-weight: 700;
  color: ${theme.colors.white};
`

export const Total = styled.p`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.gray4};

  &[data-over] {
    color: ${theme.colors.errLight};
  }
`

export const Summary = styled.details`
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlayLight};

  & > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 52px;
    padding: 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.white};
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
    & > svg {
      transition: transform 0.15s ease;
    }
  }
  &[open] > summary > svg {
    transform: rotate(180deg);
  }
`

export const SummaryBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px;
`

export const RecipientCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.card};
`

export const RecipientLine = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.chipDark};
  font-size: 14px;
  color: ${theme.colors.white};

  & > b {
    flex: none;
    font-weight: 700;
  }
  & > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${theme.colors.gray4};
  }
`

export const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`
