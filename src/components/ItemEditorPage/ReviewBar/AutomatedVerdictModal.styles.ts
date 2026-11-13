import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
`

export const Banner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 12px 16px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.errorOverlay};
  font-size: 16px;
  font-weight: 600;
  color: ${theme.colors.errorText};

  & svg {
    flex: none;
    font-size: 22px;
  }

  &[data-outcome='passed'] {
    background: ${theme.colors.successOverlay};
    color: ${theme.colors.green};
  }
  &[data-outcome='unsupported'] {
    background: ${theme.colors.warningOverlay};
    color: ${theme.colors.warningText};
  }
`

export const BannerLine = styled.p`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
`

export const Reason = styled.p`
  margin: 0 0 0 32px;
  font-size: 14px;
  font-weight: 400;
  color: ${theme.colors.softWhite};
`

export const Time = styled.span`
  margin-left: auto;
  font-size: 13px;
  font-weight: 400;
  color: ${theme.colors.gray4};
  white-space: nowrap;
`

export const Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const chevron = `
  &::-webkit-details-marker {
    display: none;
  }

  &::after {
    content: '';
    flex: none;
    width: 8px;
    height: 8px;
    margin: 0 4px 4px auto;
    border-right: 2px solid ${theme.colors.gray4};
    border-bottom: 2px solid ${theme.colors.gray4};
    transform: rotate(45deg);
    transition: transform 0.15s;
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
`

const openChevron = `
  &[open] > summary::after {
    transform: rotate(-135deg);
    margin-bottom: -4px;
  }
`

export const Item = styled.details`
  border: 1px solid ${theme.colors.cardLine};
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlayLight};

  ${openChevron}
`

export const ItemSummary = styled.summary`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 8px 12px;
  list-style: none;
  cursor: pointer;

  ${chevron}

  /* The status already takes the free space; a second auto margin would split it and center the status. */
  &::after {
    margin-left: 4px;
  }
`

export const Thumb = styled.img`
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.input};
  background: ${theme.colors.chipDark};
  object-fit: contain;
`

export const ThumbPlaceholder = styled.span`
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.input};
  background: ${theme.colors.chipDark};
`

export const ItemName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const Status = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
`

export const Count = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.softWhite};

  &[data-kind='error'] svg {
    color: ${theme.colors.errLight};
  }
  &[data-kind='warning'] svg,
  &[data-kind='unchecked'] svg {
    color: ${theme.colors.amber};
  }
  &[data-kind='passed'] svg {
    color: ${theme.colors.ok};
  }
`

export const ItemBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
`

export const Note = styled.p`
  margin: 0;
  padding: 8px 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.warningOverlay};
  font-size: 14px;
  color: ${theme.colors.warningText};
`

export const Visual = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlay};
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const VisualTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.15px;
  text-transform: uppercase;
  color: ${theme.colors.gray4};
`

export const VisualLine = styled.p`
  margin: 0;
`

export const Group = styled.details`
  border: 1px solid ${theme.colors.cardLine};
  border-radius: ${theme.radius.btnSm};

  ${openChevron}
`

export const GroupSummary = styled.summary`
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
  list-style: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray4};

  ${chevron}
`

export const GroupItems = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 8px 8px;
`
