import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export {
  DateField,
  Divider,
  ErrorText,
  Field,
  Fields,
  Footer,
  Form,
  Label,
  Note,
  Row,
  Subtitle
} from '../SellItemFlow/SellItemModal.styles'
export { Box as InputBox } from '../SellItemFlow/SellItemModal.styles'

export const Presets = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const Preset = styled.button`
  min-width: 64px;
  min-height: 44px;
  padding: 0 16px;
  border: 1.5px solid ${theme.colors.glassHover};
  border-radius: ${theme.radius.btnSm};
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.glassFaint};
  }
  &[data-selected] {
    border-color: ${theme.colors.white};
    background: rgba(255, 255, 255, 0.1);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

export const Suffix = styled.span`
  flex: none;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray4};
`

export const Summary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayLight};
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};

  & p {
    margin: 0;
  }
  & [data-muted] {
    font-size: 13px;
    color: ${theme.colors.gray4};
  }
  & s {
    color: ${theme.colors.gray4};
  }
`

export const Discounts = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
`

export const DiscountChip = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 4px 4px 4px 16px;
  border: 1px solid ${theme.colors.glassHover};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayLight};
  font-size: 14px;
  color: ${theme.colors.softWhite};

  & b {
    color: ${theme.colors.dclRed};
    font-weight: 700;
  }
  & span {
    color: ${theme.colors.gray4};
    font-size: 13px;
  }

  ${theme.media.maxWidth('mobile')} {
    width: 100%;
    justify-content: space-between;
  }
`

export const DiscountTerms = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
`
