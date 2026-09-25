import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle, hitArea } from '../OverviewPage.styles'

const { colors, font, media, radius } = theme

const tablet = media.maxWidth('tablet')
const laptop = media.maxWidth('laptop')
const desktop = media.maxWidth('desktop')
const mobile = media.maxWidth('mobile')

export const Section = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: 100%;
  margin: 40px 0;

  ${tablet} {
    padding: 0 32px;
    overflow: hidden;
  }
`

export const Title = styled(SectionTitle)`
  margin-bottom: 32px;
`

export const Card = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 32px;
  border-radius: ${radius.banner};
  background: ${colors.text2};
  color: ${colors.white};

  ${laptop} {
    flex-direction: column;
    height: auto;
    padding: 0;
  }
`

export const Figure = styled.div`
  flex-shrink: 0;
  width: 35%;
  height: 100%;
  min-height: 530px;
  margin-right: 24px;
  border-radius: ${radius.cardLg};
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  transition: transform 0.3s ease-in-out;

  & img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @media (hover: hover) {
    &:hover {
      transform: scale(1.05);
    }
  }

  ${laptop} {
    position: relative;
    width: 100%;
    height: 223px;
    min-height: 223px;
    margin-right: 0;
    border-radius: ${radius.banner} ${radius.banner} 0 0;
    background-size: 100%;
    overflow: hidden;

    & img {
      position: absolute;
      top: 50%;
      left: 50%;
      width: auto;
      height: 100%;
      transform: translate(-50%, -50%);
    }
  }
`

export const Info = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: calc(65% - 24px);

  ${laptop} {
    width: calc(100% - 16px);
    margin: 0 8px 8px;
    padding: 32px 0;
  }
`

export const CardTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  line-height: 30px;
  letter-spacing: ${font.tracking};

  ${desktop} {
    font-size: 20px;
    line-height: 16px;
  }
`

export const CardDescription = styled.p`
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: ${font.tracking};
  color: ${colors.muted2};

  ${desktop} {
    font-size: 16px;
  }
`

export const Tabs = styled.div`
  display: flex;
  height: 24px;
  margin-bottom: 24px;

  ${tablet} {
    justify-content: center;
  }
`

export const Tab = styled.button`
  margin-right: 24px;
  padding: 0 0 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: ${colors.muted};
  font-size: 14px;
  font-weight: 500;
  line-height: 16px;
  text-transform: uppercase;
  cursor: pointer;
  ${hitArea(10)}

  &[data-selected] {
    border-bottom-color: ${colors.white};
    color: ${colors.white};
    font-weight: 600;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${tablet} {
    margin-right: 16px;
    padding: 8px 0 0;
    font-size: 16px;
  }
`

export const TabPanel = styled.div`
  display: flex;
  flex-direction: column;
`

export const InfoBlock = styled.div`
  margin-bottom: 8px;
  padding: 16px 24px;
  border-radius: ${radius.cardLg};
  background: ${colors.gray0Half};

  &:last-child {
    margin-bottom: 0;
  }
`

export const InfoTitle = styled.h4`
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: ${font.tracking};
`

export const InfoBody = styled.p`
  margin: 0;
  font-size: 18px;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: ${font.tracking};
  color: ${colors.gray4};
`

export const Skills = styled.div`
  display: flex;
  flex-wrap: wrap;
`

export const Skill = styled.span`
  margin: 0 8px 8px 0;
  padding: 8px 16px;
  border-radius: ${radius.cardLg};
  background: ${colors.gray0};
  font-size: 13px;
  font-weight: 600;
  line-height: normal;
  text-transform: uppercase;
`

export const Links = styled.div`
  display: flex;
  flex-wrap: wrap;

  ${laptop} {
    flex-direction: column;
  }
`

export const Link = styled.a`
  display: block;
  width: 50%;

  ${mobile} {
    width: 100%;
  }
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: ${colors.apricot};
  text-decoration: underline;

  &:hover,
  &:active,
  &:visited {
    color: ${colors.apricot};
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
`
