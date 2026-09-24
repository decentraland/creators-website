import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { Section as BaseSection, SectionTitle } from '../OverviewPage.styles'

const { colors, gradients, media, radius } = theme

const mobile = media.maxWidth('mobile')
const stacked = media.maxWidth('lg')

export const Section = styled(BaseSection)`
  padding-bottom: 100px;

  ${mobile} {
    padding-bottom: 40px;
  }
`

export const Title = styled(SectionTitle)`
  margin-bottom: 32px;
`

export const Grid = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;

  ${stacked} {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
`

export const Card = styled.a`
  display: flex;
  flex: 1;
  max-width: 450px;
  border-radius: ${radius.banner};
  color: ${colors.white};
  /* Reveals the CTA on hover; devices without hover keep it always shown. */
  --cta-reveal: 1;

  &[data-gradient='amethyst'] {
    background: ${gradients.amethyst};
  }
  &[data-gradient='apricot'] {
    background: ${gradients.apricot};
  }
  &[data-gradient='cerise'] {
    background: ${gradients.cerise};
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

  ${stacked} {
    width: 100%;
    max-width: 640px;
  }
`

export const CardInner = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 24px 24px 32px;
  border-radius: 20px;
  overflow: hidden;
  transition: transform 0.3s ease-in-out;

  @media (hover: hover) {
    &:hover {
      transform: scale(1.05);
    }
  }

  ${mobile} {
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
    max-width: 100%;
    object-fit: contain;
  }

  ${mobile} {
    height: 138px;
    margin-bottom: 16px;

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
`

export const CardTitle = styled.h3`
  margin: 0 10px 8px;
  font-size: 24px;
  font-weight: 600;
  line-height: 30px;

  ${mobile} {
    font-size: 20px;
    font-weight: 700;
    line-height: 28px;
  }
`

export const CardDescription = styled.p`
  flex: 1;
  margin: 0 10px;
  font-size: 18px;
  line-height: 24px;
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

  ${mobile} {
    margin-top: 12px;
  }
`
