import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

const { colors, font, gradients, media } = theme

const mobile = media.maxWidth('mobile')
const tablet = media.maxWidth('tablet')

export const Section = styled.section`
  position: relative;
  width: 100%;
  padding: 80px 160px;
  color: ${colors.offWhite};

  ${tablet} {
    padding: 48px 32px 80px;
  }
`

const corner = (to: string, size: string) =>
  `linear-gradient(to ${to}, ${colors.offWhite} ${size}, transparent ${size})`

/* Four L-shaped corner marks drawn with gradients, one per corner of the frame. */
export const Frame = styled.div`
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

  ${tablet} {
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

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1000px;
  margin: auto;
  padding: 64px 0 80px;

  ${tablet} {
    padding: 48px 0 64px;
  }
`

export const Subtitle = styled.p`
  margin: 0;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  line-height: 19px;
  letter-spacing: ${font.tracking};
  text-transform: uppercase;
  color: ${colors.offWhiteMuted};
`

export const Title = styled(SectionTitle)`
  padding-bottom: 0.5em;
`

export const Row = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 12px;
  padding: 12px 32px;
  border-radius: 32px;
  background: ${colors.text2};
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
    width: 40px;
    height: 40px;
    color: ${colors.white};
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
  &[data-open] svg {
    transform: rotate(180deg);
  }
  &[data-open] svg circle {
    fill: ${colors.white};
    opacity: 1;
  }
  &[data-open] svg path {
    fill: ${colors.text2};
  }

  ${mobile} {
    margin-bottom: 8px;
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
`

export const QuestionText = styled.h3`
  margin: 0;
  font-size: 26px;
  font-weight: 300;
  line-height: 28px;
  letter-spacing: -0.011em;
  color: ${colors.offWhiteMuted};

  ${tablet} {
    font-size: 16px;
    letter-spacing: -0.01em;
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
  font-weight: 400;
  line-height: 165%;
  letter-spacing: ${font.tracking};
  white-space: pre-line;
  color: ${colors.offWhite};
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
