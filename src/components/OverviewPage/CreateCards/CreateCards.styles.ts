import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

const { colors, media, radius } = theme

const mobile = media.maxWidth('mobile')
const stacked = media.maxWidth('lg')

export const Section = styled.section`
  width: 100%;
  margin: 40px 0;
`

export const Title = styled(SectionTitle)`
  margin-bottom: 32px;
  padding: 0 16px;
`

export const Card = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 32px;
  border-radius: ${radius.banner};
  background: ${colors.text2};
  color: ${colors.white};

  ${stacked} {
    flex-direction: column;
    padding: 0;
  }
`

export const Figure = styled.div`
  display: flex;
  flex: 0 0 35%;
  align-self: stretch;
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

  ${stacked} {
    flex: none;
    width: 100%;
    height: 223px;
    min-height: 223px;
    margin-right: 0;
    border-radius: ${radius.banner} ${radius.banner} 0 0;
    overflow: hidden;
    justify-content: center;

    & img {
      width: auto;
    }
  }
`

export const Info = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;

  ${stacked} {
    width: 100%;
    padding: 32px 8px;
  }
`

export const CardTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  line-height: 30px;

  ${mobile} {
    font-size: 20px;
  }
`

export const CardDescription = styled.p`
  margin: 0 0 16px;
  font-size: 18px;
  line-height: 24px;
  color: ${colors.muted2};

  ${mobile} {
    font-size: 16px;
  }
`

export const Tabs = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 24px;

  ${mobile} {
    justify-content: center;
    gap: 16px;
  }
`

export const Tab = styled.button`
  min-height: 44px;
  padding: 0 0 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: ${colors.muted};
  font-size: 14px;
  font-weight: 500;
  line-height: 16px;
  text-transform: uppercase;

  &[data-selected] {
    border-bottom-color: ${colors.white};
    color: ${colors.white};
    font-weight: 600;
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${mobile} {
    font-size: 16px;
  }
`

export const TabPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const InfoBlock = styled.div`
  padding: 16px 24px;
  border-radius: ${radius.cardLg};
  background: ${colors.overlay};
`

export const InfoTitle = styled.h4`
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 500;
  line-height: 20px;
`

export const InfoBody = styled.p`
  margin: 0;
  font-size: 18px;
  line-height: 24px;
  color: ${colors.gray4};
`

export const Skills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const Skill = styled.span`
  padding: 8px 16px;
  border-radius: ${radius.cardLg};
  background: ${colors.gray0};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
`

export const Links = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  ${stacked} {
    grid-template-columns: 1fr;
  }
`

export const Link = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: ${colors.apricot};
  text-decoration: underline;

  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }
`
