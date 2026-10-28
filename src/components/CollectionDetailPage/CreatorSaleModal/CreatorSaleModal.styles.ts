import styled from '@emotion/styled'
import { SaleIcon as Icon } from './SaleIcon'
import { SaleCountdown } from './SaleCountdown'
import { SaleTag } from '../SaleTag'
import { theme } from '~/styles/theme'

// The Shop's radii: its buttons and fields are 8px where this app's are 12px.
const { colors, font, media } = theme
const radius = { ...theme.radius, btn: '8px' }

/** A surface inside the card: one step lighter than it, the way My Store lays panels on the page field. */
const raised = 'rgba(255, 255, 255, 0.06)'
const hairline = 'rgba(255, 255, 255, 0.12)'

export { Scrim, Title, CloseButton as Close } from '~/components/Modal/Modal.styles'

// Modal's `compact` padding.
const CARD_PAD_TOP = 12
const CARD_PAD = 16

export const Card = styled.div`
  width: 560px;
  max-width: 80vw;
  max-height: 90vh;
  max-height: 90dvh;
  overflow: hidden;
  background: ${colors.modalSurface};
  border-radius: ${radius.modal};
  padding: ${CARD_PAD_TOP}px ${CARD_PAD}px ${CARD_PAD}px;
  box-shadow: 0 16px 48px ${colors.overlayStrong};
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: ${colors.softWhite};
  font-family: ${font.sans};

  /* It takes focus as a dialog does; the ring belongs to the controls inside it. */
  &:focus {
    outline: none;
  }

  /* The credits mark is pinned near-black for white cards (Icon.css); on this one it has to be light. */
  .ccy-mark,
  .ccy {
    color: ${colors.softWhite};
  }

  /* The shared notice is drawn for white surfaces: dark red text that disappears on this card. */
  [data-testid='creator-sale-error'] {
    border-color: rgba(255, 45, 85, 0.5);
    background: rgba(255, 45, 85, 0.16);
    color: ${colors.dclRed};
  }
  [data-testid='creator-sale-error'] > span {
    color: ${colors.white};
  }

  ${media.maxWidth('mobile')} {
    max-width: 100%;
  }
`

export const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

export const Divider = styled.hr`
  flex: none;
  width: 100%;
  margin: 0;
  border: 0;
  border-top: 1px solid ${colors.glassHover};
`

export const Steps = styled.div`
  padding: 8px 0 4px;
`

export const Subtitle = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: ${colors.gray4};
`

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const FieldLabel = styled.span`
  font-size: 14px;
  line-height: 1.57;
  color: ${colors.softWhite};
`

export const FieldHint = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: ${colors.gray4};
`

export const CollectionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid ${hairline};
  border-radius: ${radius.card};
  background: ${raised};
`

/** The mosaic's frame: a fixed, rounded square so rows stay aligned whatever each collection holds. */
export const RowThumb = styled.span`
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: ${radius.btn};
  overflow: hidden;
  background: ${colors.media};
`

export const RowText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const RowName = styled.span`
  font-weight: 600;
  font-size: 15px;
  color: ${colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const RowMeta = styled.span`
  font-size: 13px;
  color: ${colors.gray4};
`

/** The discounts as separate pills, the Builder's filter chips: soft white once picked. */
export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  ${media.maxWidth('mobile')} {
    gap: 8px;
  }
`

export const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  background: ${colors.glass};
  color: ${colors.white};
  font-family: ${font.sans};
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.46px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled):not([data-selected]) {
    background: ${colors.glassHover};
  }
  &[data-selected] {
    background: ${colors.softWhite};
    color: ${colors.text};
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/** A short framed number input with a unit around it (the custom percentage, the unit limit). */
export const InlineInput = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  width: fit-content;
  height: 44px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: ${radius.pill};
  background: ${raised};
  font-size: 14px;
  font-weight: 600;
  color: ${colors.softWhite};

  &:focus-within {
    border-color: ${colors.softWhite};
  }
  &[aria-invalid='true'] {
    border-color: ${colors.dclRed};
  }
  /* The custom discount, open in its own pill: lit like a picked one. */
  &[data-selected] {
    height: 40px;
    padding: 0 16px;
    border-color: ${colors.softWhite};
    border-radius: 20px;
    background: ${colors.softWhite};
    color: ${colors.text};

    input {
      color: ${colors.text};
    }
  }
  &[data-selected][aria-invalid='true'] {
    border-color: ${colors.dclRed};
  }

  input {
    width: 3ch;
    border: 0;
    outline: none;
    background: transparent;
    font-family: ${font.sans};
    font-size: 15px;
    font-weight: 700;
    color: ${colors.white};

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    &[type='number'] {
      -moz-appearance: textfield;
      appearance: textfield;
    }
  }
`

/** Anchors the calendar under its trigger; the trigger stacks above it so the calendar slides out from behind. */
export const WhenWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
`

/**
 * The calendar's anchor, laid over the trigger at body level. The card scrolls, so a popup inside it would be
 * clipped; out here it floats over the page. Transparent to presses itself, so the trigger under it still works.
 */
export const WhenAnchor = styled.div`
  position: fixed;
  z-index: ${theme.z.overlay + 1};
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`

/** Drawn like the Builder's Select trigger: an outlined field whose border turns white while it is open. */
export const WhenTrigger = styled.button`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 56px;
  padding: 0 12px;
  border: 1px solid ${colors.muted2};
  border-radius: 6px;
  background: transparent;
  color: ${colors.softWhite};
  font-family: ${font.sans};

  /* It takes focus as a dialog does; the ring belongs to the controls inside it. */
  &:focus {
    outline: none;
  }
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-align: left;
  cursor: pointer;

  > span:not(.ico) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ico {
    flex: none;
    width: 24px;
    height: 24px;
    transition: transform 0.15s ease;
  }
  .ico[data-open] {
    transform: rotate(180deg);
  }
  &:focus-visible,
  &[aria-expanded='true'] {
    border-color: ${colors.white};
    outline: 0;
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
  @media (prefers-reduced-motion: reduce) {
    .ico {
      transition: none;
    }
  }
`

export const CapLabel = styled.label`
  font-size: 14px;
  line-height: 1.57;
  color: ${colors.softWhite};
`

export const CapInput = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 54px;
  padding: 8px;
  border: 1.5px solid ${colors.white};
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${colors.softWhite};
    font-family: ${font.sans};
    font-size: 16px;
    outline: 0;
  }
  input::placeholder {
    color: ${colors.media};
    opacity: 1;
  }
  > span {
    flex: none;
    font-size: 14px;
    color: ${colors.media};
    font-variant-numeric: tabular-nums;
  }
  &[data-disabled] {
    opacity: 0.6;
  }
`

export const CapHint = styled.p`
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 12px;
  color: ${colors.muted2};
`

/** What buyers will see: every listed item, priciest first, in a row that scrolls sideways. */
export const PreviewHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

export const StripArrows = styled.div`
  display: flex;
  gap: 6px;

  /* A phone swipes the row; the arrows are for a pointer. */
  ${media.maxWidth('mobile')} {
    display: none;
  }
`

export const StripArrow = styled.button`
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${hairline};
  border-radius: 50%;
  background: ${raised};
  color: ${colors.softWhite};
  cursor: pointer;

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
  &:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.32);
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
`

export const PreviewStrip = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const PreviewCard = styled.div`
  flex: none;
  width: 148px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  border-radius: ${radius.card};
  background: ${raised};
  border: 1px solid ${hairline};
`

export const PreviewMedia = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: ${radius.btn};
  overflow: hidden;
  background: ${colors.media};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

export const PreviewTag = styled(SaleTag)`
  position: absolute;
  top: 6px;
  left: 6px;
`

export const PreviewName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const PreviewPrices = styled.span`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
`

export const PreviewNow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 16px;
  font-weight: 700;
  color: ${colors.white};
`

export const PreviewWas = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${colors.gray4};
  text-decoration: line-through;
`

/**
 * Text wearing the currency mark in front. Plain inline, not inline-flex — a flex box here makes `innerText`
 * break the line around it, which is the text the e2e suite reads the sentence from.
 */
export const Marked = styled.b`
  font-weight: 700;
  color: ${colors.white};
  white-space: nowrap;

  .ico {
    margin-right: 0.3em;
  }
`

/** Everything between the stepper and the actions: the only part that scrolls, so both stay in view. */
export const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  /* Room for the focus rings the scroll box would otherwise clip. */
  margin: -4px;
  padding: 4px;
`

export const Actions = styled.div`
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: ${CARD_PAD}px;
  border-top: 1px solid ${colors.glassHover};

  & > button {
    flex: 1 1 0;
    min-width: 0;
  }

  ${media.maxWidth('mobile')} {
    gap: 12px;

    & > button {
      flex-basis: 100%;
    }
    & > button[data-variant='secondary'] {
      order: 1;
    }
  }
`

export const ActionsNote = styled.div`
  flex: 1 0 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const SuccessDetail = styled.span`
  margin-top: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  font-size: 15px;
  color: ${colors.gray4};
`

// The default pill is purple on a purple tint, made for light surfaces; on this dark card the value goes white.
export const SuccessCountdown = styled(SaleCountdown)`
  padding: 0;
  background: none;
  color: ${colors.white};
  font-size: 15px;
  font-weight: 700;
`

/** The review step: what the sale will do, item by item, before anything is signed. */
export const ReviewSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: ${radius.card};
  background: ${raised};
  border: 1px solid ${hairline};
`

export const ReviewPct = styled.span`
  justify-self: start;
  display: inline-flex;
`

/** One row of the summary: its label, the value, and — for the window — how long until it. */
export const ReviewWhenRow = styled.div`
  display: grid;
  /* Fixed, not content-sized: each row is its own grid, so a max-content track would line each label up
     with nothing. 86px clears the longest label in any locale. */
  grid-template-columns: 86px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  font-size: 15px;
  line-height: 1.5;
`

export const ReviewWhenLabel = styled.span`
  color: ${colors.gray4};
  font-size: 13px;
`

export const ReviewWhenValue = styled.b`
  font-weight: 700;
  color: ${colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ReviewWhenLeft = styled(SaleCountdown)`
  flex: none;
  padding: 0;
  background: none;
  color: ${colors.gray4};
  font-size: 14px;
  font-weight: 600;
`

export const ReviewGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const ReviewGroupTitle = styled.h3`
  margin: 0;
  font-weight: 600;
  font-size: 14px;
  color: ${colors.white};
`

export const ReviewList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  /* Long collections stay inside the modal instead of pushing the actions off-screen. */
  max-height: 232px;
  overflow-y: auto;
`

export const ReviewRow = styled.li`
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: ${radius.btn};
  background: ${raised};
  border: 1px solid ${hairline};

  &[data-muted] {
    opacity: 0.7;
  }
`

export const ReviewThumb = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${radius.btn};
  object-fit: cover;
  background: ${colors.media};
`

export const ReviewName = styled.span`
  font-size: 15px;
  color: ${colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/** Two right-aligned columns so the old and new prices line up down the list. */
export const ReviewPrices = styled.span`
  display: grid;
  grid-template-columns: minmax(34px, auto) minmax(46px, auto);
  align-items: center;
  gap: 6px;
  white-space: nowrap;
`

export const ReviewWas = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  color: ${colors.gray4};
  text-decoration: line-through;
  font-weight: 600;
  font-size: 15px;
`

export const ReviewNow = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-weight: 700;
  font-size: 19px;
  color: ${colors.white};
`

export const ReviewUnaffected = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${colors.gray4};
  white-space: nowrap;
`

/** Opens the reason a row is excluded. Focusable, so the explanation is reachable without a hover. */
export const UnaffectedInfo = styled(Icon)`
  /* Drawn at 14px, hit at 26px: padding cancelled by an equal negative margin. */
  width: 14px;
  height: 14px;
  padding: 6px;
  margin: -6px;
  box-sizing: content-box;
  color: ${colors.gray4};
  cursor: help;

  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
    border-radius: 50%;
  }
`

export const ReviewFoot = styled.p`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: ${radius.card};
  background: ${raised};
  border: 1px solid ${hairline};
  font-size: 14px;
  line-height: 1.45;
  color: ${colors.softWhite};

  b {
    font-weight: 700;
    color: ${colors.white};
  }
  svg {
    flex: none;
    color: ${colors.gray4};
  }
`

/** The one line that says what to do about a group the discount cannot reach. */
export const ReviewFootNote = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: ${colors.gray4};
`
