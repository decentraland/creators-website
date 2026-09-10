import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export { Spinner } from '~/styles/shared'

// Hairline under the title bar, matching the footer's.
export const Divider = styled.hr`
  margin: 0 0 16px;
  border: 0;
  border-top: 1px solid ${theme.colors.glassHover};
`

// The mockup is drawn at 2x: 110px thumbnail, 14px item name, 54px fields, 560px dialog.
export const Form = styled.form`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  width: 560px;
  max-width: 100%;
  min-height: 0;
`

// Everything but the footer, scrolling on short viewports so the actions stay in reach; while a submit is
// in flight it goes inert and dims like the publish payment step.
export const Fields = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  margin: 0 -4px;
  padding: 0 4px 4px;
  overflow-y: auto;

  /* Scroll, don't squeeze: the card and fields keep their size inside the scrolling column. */
  & > * {
    flex: none;
  }

  &[data-busy] {
    pointer-events: none;
    opacity: 0.7;
  }
`

export const Card = styled.div`
  display: flex;
  gap: 20px;
  border-radius: ${theme.radius.card};
  background: ${theme.colors.overlayLight};
  overflow: hidden;
`

export const CardThumb = styled.div`
  flex: none;
  width: 110px;
  height: 110px;

  & > * {
    width: 100%;
    height: 100%;
    border-radius: ${theme.radius.card};
  }
`

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  padding: 12px 12px 12px 0;
`

export const CardName = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: ${theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Availability = styled.span`
  font-size: 13px;
  color: ${theme.colors.gray4};
`

export const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  min-width: 28px;
  padding: 0 6px;
  border-radius: ${theme.radius.chip};
  background: ${theme.colors.chipDark};
  color: ${theme.colors.white};

  & > span,
  & > svg {
    width: 16px;
    height: 16px;
  }
`

export const Subtitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  color: ${theme.colors.white};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const Label = styled.span`
  font-size: 13px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

export const Box = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 54px;
  padding: 0 16px;
  border: 1.5px solid ${theme.colors.white};
  border-radius: ${theme.radius.btnSm};
  background: rgba(255, 255, 255, 0.05);
  color: ${theme.colors.white};

  &:focus-within {
    box-shadow: 0 0 0 2px ${theme.colors.glassLine};
  }
  &[data-invalid] {
    background: ${theme.colors.errOverlay};
    border-color: ${theme.colors.errLight};
  }
  &[data-disabled] {
    opacity: 0.5;
  }

  & input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.white};
    color-scheme: dark;

    &::placeholder {
      font-weight: 400;
      color: ${theme.colors.gray4};
    }
    &:disabled {
      color: ${theme.colors.gray4};
    }
  }

  & > svg {
    flex: none;
    font-size: 18px;
  }
`

// The react-datepicker field and its calendar, on the dialog's dark surface (shop restyles it the same way, in white).
export const DateField = styled(Box)`
  .react-datepicker-wrapper,
  .react-datepicker__input-container {
    flex: 1;
    display: flex;
  }

  .react-datepicker-popper {
    z-index: ${theme.z.prompt};
  }
  .react-datepicker {
    font-family: ${theme.font.sans};
    font-size: 13px;
    color: ${theme.colors.white};
    background: ${theme.colors.modalSurface};
    border: 1px solid ${theme.colors.glassHover};
    border-radius: ${theme.radius.btn};
    box-shadow: 0 12px 32px ${theme.colors.overlayStrong};
    overflow: hidden;
  }
  .react-datepicker__header {
    background: none;
    border-bottom: 1px solid ${theme.colors.glassHover};
    padding-top: 12px;
  }
  .react-datepicker__current-month {
    color: ${theme.colors.white};
    font-weight: 600;
    font-size: 14px;
  }
  .react-datepicker__day-name {
    color: ${theme.colors.gray4};
  }
  .react-datepicker__day {
    color: ${theme.colors.white};
    border-radius: ${theme.radius.btnSm};
  }
  .react-datepicker__day:hover {
    background: ${theme.colors.glassFaint};
  }
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background: ${theme.colors.dclRed};
    color: ${theme.colors.white};
  }
  .react-datepicker__day--today {
    font-weight: 700;
  }
  .react-datepicker__day--disabled,
  .react-datepicker__day--disabled:hover {
    color: ${theme.colors.gray4};
    background: none;
    opacity: 0.4;
  }
  .react-datepicker__navigation-icon::before {
    border-color: ${theme.colors.white};
  }
`

export const Glyph = styled.span`
  display: inline-flex;
  flex: none;
  font-size: 20px;
`

export const Usd = styled.span`
  flex: none;
  font-size: 13px;
  color: ${theme.colors.gray4};
`

export const Rate = styled.span`
  align-self: flex-end;
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: ${theme.colors.errLight};
`

export const Note = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayLight};
  font-size: 13px;
  line-height: 1.5;
  color: ${theme.colors.gray4};

  & > svg {
    flex: none;
    font-size: 18px;
    margin-top: 1px;
  }

  & p {
    margin: 0;
  }

  & b {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: ${theme.colors.softWhite};
    font-weight: 600;
  }

  & b svg {
    font-size: 14px;
  }
`

export const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid ${theme.colors.glassHover};

  & > * {
    flex: 1;
    min-width: 0;
  }

  ${mobile} {
    flex-direction: column-reverse;
    gap: 12px;

    & > * {
      flex: none;
    }
  }
`

// --- Beneficiary combobox ---

export const Combo = styled.div`
  position: relative;
`

export const ComboToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 40px;
  height: 40px;
  margin-right: -10px;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: none;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.glassFaint};
  }
  &[data-open] > svg {
    transform: rotate(180deg);
  }
`

export const Options = styled.ul`
  position: absolute;
  z-index: 1;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 220px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.modalSurface};
  box-shadow: 0 8px 24px ${theme.colors.overlayStrong};
  border: 1px solid ${theme.colors.glassHover};
  overflow-y: auto;
`

export const Option = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 4px 10px;
  border-radius: ${theme.radius.chip};
  font-size: 14px;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover,
  &[data-active] {
    background: ${theme.colors.glassFaint};
  }

  & > span:nth-of-type(1) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const OptionNote = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 10px;
  font-size: 13px;
  color: ${theme.colors.gray4};
`

export const OptionAddress = styled.span`
  margin-left: auto;
  flex: none;
  font-size: 12px;
  color: ${theme.colors.gray4};
`

export const Avatar = styled.img`
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: ${theme.colors.glassHover};
`

export const AvatarFallback = styled.span`
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${theme.gradients.amethyst};
`

export const ChipName = styled.span`
  flex: none;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.white};
`

export const ChipAddress = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: ${theme.colors.white};
`

export const ChipClear = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 40px;
  height: 40px;
  margin-left: auto;
  margin-right: -10px;
  border: 0;
  border-radius: ${theme.radius.btnSm};
  background: none;
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.glassFaint};
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
