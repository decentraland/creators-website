import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

const { colors, font, gradients, media, radius } = theme

const tablet = media.maxWidth('tablet')

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: 100%;
  padding-bottom: 100px;

  ${tablet} {
    padding: 0 32px 40px;
    overflow: hidden;
  }
`

export const Title = styled(SectionTitle)`
  margin-bottom: 32px;
`

export const Grid = styled.div`
  display: flex;
  justify-content: center;

  ${tablet} {
    flex-direction: column;
    gap: 20px;
  }
`

export const Card = styled.a`
  display: flex;
  flex: 1;
  max-width: 450px;
  margin-right: 24px;
  border-radius: ${radius.banner};
  color: ${colors.white};
  /* Reveals the CTA on hover; devices without hover keep it always shown. */
  --cta-reveal: 1;

  &:last-child {
    margin-right: 0;
  }
  &[data-gradient='orchid'] {
    background: ${gradients.orchid};
  }
  &[data-gradient='apricot'] {
    background: ${gradients.apricot};
  }
  &[data-gradient='raspberry'] {
    background: ${gradients.raspberry};
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  @media (hover: hover) {
    --cta-reveal: 0;
    &:hover,
    &:focus-visible {
      --cta-reveal: 1;
    }
  }

  ${tablet} {
    width: 100%;
    max-width: 100%;
    margin-right: 0;
  }
`

export const CardInner = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 24px 24px 32px;
  border-radius: 20px;
  overflow: hidden;
  transition: transform 0.3s ease-in-out;

  @media (hover: hover) {
    &:hover {
      transform: scale(1.05);
    }
  }

  ${tablet} {
    justify-content: flex-start;
    padding: 26px 24px;
  }
`

export const CardImage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-bottom: 24px;
  border-radius: ${radius.cardLg};
  overflow: hidden;

  & img {
    flex: 1 1 auto;
    min-height: 0;
    max-width: 100%;
    object-fit: contain;
  }

  ${tablet} {
    height: 138px;
    min-height: 138px;
    margin-bottom: 16px;

    & img {
      max-width: none;
      min-width: 100%;
      min-height: 100%;
    }
  }
`

export const CardText = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-self: flex-start;
  justify-content: flex-start;
`

export const CardTitle = styled.h3`
  margin: 0 0 8px;
  padding: 0 10px;
  font-size: 24px;
  font-weight: 600;
  line-height: 30px;
  letter-spacing: ${font.tracking};

  ${tablet} {
    font-size: 20px;
    font-weight: 700;
    line-height: 28px;
  }
`

export const CardDescription = styled.p`
  margin: 0;
  padding: 0 10px;
  font-size: 18px;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: ${font.tracking};
`

export const CardCta = styled.span`
  align-self: flex-start;
  margin: 16px 10px 0;
  padding: 10px 24px;
  border-radius: ${radius.btn};
  background: ${colors.white};
  color: ${colors.text2};
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0.61px;
  text-transform: uppercase;
  opacity: var(--cta-reveal);
  transform: translateY(calc((1 - var(--cta-reveal)) * 8px));
  transition:
    opacity 0.3s ease-in-out,
    transform 0.3s ease-in-out;

  &:hover {
    background: ${colors.media};
  }

  ${tablet} {
    margin-top: 12px;
  }
`
