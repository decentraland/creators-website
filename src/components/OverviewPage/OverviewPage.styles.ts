// Primitives shared by the overview sections; each section keeps its own styles next to it.
import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const { colors, font, gradients, media } = theme

const tablet = media.maxWidth('tablet')

/** Invisible enlarged hit area (~44px targets) without changing the element's layout box. */
export const hitArea = (vertical: number, horizontal = 0) => `
  position: relative;
  &::before {
    content: '';
    position: absolute;
    inset: -${vertical}px -${horizontal}px;
  }
`

export const SectionTitle = styled.h2`
  max-width: 80vw;
  margin: 0 auto;
  text-align: center;
  font-size: 48px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  color: ${colors.softWhite};

  & span {
    background: ${gradients.sunrise};
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  ${tablet} {
    font-size: 32px;
  }
`

/** A horizontally scrolling row of cards, edge to edge, scrollbar hidden. */
export const Rail = styled.div`
  display: flex;
  gap: 20px;
  padding: 0 100px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  ${tablet} {
    padding: 0 16px;
  }
`

export const ViewAllLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  margin: 40px auto 0;
  color: ${colors.softWhite};
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  ${hitArea(9)}

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
