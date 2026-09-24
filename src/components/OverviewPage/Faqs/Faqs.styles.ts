import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { GUTTER, GUTTER_MOBILE, SectionTitle } from '../OverviewPage.styles'

const { colors, gradients, media } = theme

const mobile = media.maxWidth('mobile')

export const Section = styled.section`
  width: 100%;
  padding: 80px ${GUTTER};
  color: ${colors.white};

  ${mobile} {
    padding: 48px ${GUTTER_MOBILE} 80px;
  }
`

const corner = (to: string, size: string) => `linear-gradient(to ${to}, ${colors.white} ${size}, transparent ${size})`

/* Four L-shaped corner marks drawn with gradients, one per corner of the frame. */
export const Frame = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 1000px;
  margin: 0 auto;
  padding: 64px 32px 80px;
  background:
    ${corner('right', '4px')} 0 0,
    ${corner('right', '4px')} 0 100%,
    ${corner('left', '4px')} 100% 0,
    ${corner('left', '4px')} 100% 100%,
    ${corner('bottom', '4px')} 0 0,
    ${corner('bottom', '4px')} 100% 0,
    ${corner('top', '4px')} 0 100%,
    ${corner('top', '4px')} 100% 100%;
  background-repeat: no-repeat;
  background-size: 20px 20px;

  ${mobile} {
    padding: 48px 16px 64px;
    background:
      ${corner('right', '2px')} 0 0,
      ${corner('right', '2px')} 0 100%,
      ${corner('left', '2px')} 100% 0,
      ${corner('left', '2px')} 100% 100%,
      ${corner('bottom', '2px')} 0 0,
      ${corner('bottom', '2px')} 100% 0,
      ${corner('top', '2px')} 0 100%,
      ${corner('top', '2px')} 100% 100%;
    background-repeat: no-repeat;
    background-size: 10px 10px;
  }
`

export const Subtitle = styled.p`
  margin: 0;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  line-height: 19px;
  text-transform: uppercase;
  color: ${colors.muted2};
`

export const Title = styled(SectionTitle)`
  margin-bottom: 40px;
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const Row = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 32px;
  border-radius: 32px;
  background: ${colors.text2};
  color: ${colors.white};
  cursor: pointer;
  overflow: hidden;

  /* The hover sweep fades in over the flat surface rather than swapping backgrounds abruptly. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: ${gradients.dusk};
    opacity: 0;
    transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  &:hover::after {
    opacity: 1;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  & svg {
    flex: none;
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
  &[data-open] svg {
    transform: rotate(180deg);
  }

  ${mobile} {
    padding: 16px 24px;
    border-radius: 24px;

    & svg {
      width: 36px;
      height: 36px;
    }
  }
`

export const Question = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
`

export const QuestionText = styled.h3`
  margin: 0;
  font-size: 28px;
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.011em;
  color: ${colors.gray4};

  ${mobile} {
    font-size: 16px;
    line-height: 28px;
  }
`

export const Answer = styled.div`
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.35s cubic-bezier(0.16, 1, 0.3, 1);

  [data-open] > & {
    grid-template-rows: 1fr;
    margin-top: 8px;
    opacity: 1;
  }
`

export const AnswerText = styled.p`
  min-height: 0;
  margin: 0;
  overflow: hidden;
  font-size: 16px;
  line-height: 165%;
  white-space: pre-line;
`

export const Cta = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;

  ${mobile} {
    & a {
      width: 100%;
    }
  }
`
