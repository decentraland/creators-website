// Primitives shared by the overview sections; each section keeps its own styles next to it.
import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const { colors, gradients, media } = theme

const mobile = media.maxWidth('mobile')

/** Side gutters: the ui2 navbar's 54px on desktop, 16px on phones. */
export const GUTTER = '54px'
export const GUTTER_MOBILE = '16px'

export const Section = styled.section`
  width: 100%;
  padding: 0 ${GUTTER};

  ${mobile} {
    padding: 0 ${GUTTER_MOBILE};
  }
`

export const SectionTitle = styled.h2`
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
  font-size: 48px;
  font-weight: 600;
  line-height: 1.15;
  color: ${colors.softWhite};
  white-space: pre-line;

  & span {
    background: ${gradients.ember};
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  ${mobile} {
    font-size: 32px;
  }
`

/** A horizontally scrolling row of cards, edge to edge, scrollbar hidden. */
export const Rail = styled.div`
  display: flex;
  gap: 20px;
  padding: 8px ${GUTTER};
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  & > * {
    scroll-snap-align: start;
  }

  ${mobile} {
    padding: 8px ${GUTTER_MOBILE};
  }
`

export const ViewAllLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  margin: 32px auto 0;
  color: ${colors.softWhite};
  font-size: 18px;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
`

export const Centered = styled.div`
  display: flex;
  justify-content: center;
`
