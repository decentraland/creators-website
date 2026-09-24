import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { Rail, SectionTitle } from '../OverviewPage.styles'

export { Centered, ViewAllLink } from '../OverviewPage.styles'

const { colors, gradients, media } = theme

const stacked = media.maxWidth('lg')

export const Section = styled.section`
  width: 100%;
  padding: 40px 0 100px;
`

export const Title = styled(SectionTitle)`
  margin-bottom: 54px;
  padding: 0 16px;
`

export const Posts = styled(Rail)`
  justify-content: center;

  ${stacked} {
    justify-content: flex-start;
  }
`

export const PostCard = styled.a`
  display: flex;
  flex: 0 1 380px;
  flex-direction: column;
  min-width: 300px;
  border-radius: 20px;
  background: ${colors.text2};
  color: ${colors.white};
  overflow: hidden;
  transition: transform 0.35s ease-in-out;

  @media (hover: hover) {
    &:hover {
      transform: scale(1.03);
    }
  }
  &:focus-visible {
    outline: 2px solid ${colors.softWhite};
    outline-offset: 2px;
  }

  ${stacked} {
    flex: 0 0 300px;
  }
`

export const PostImage = styled.div`
  height: 200px;
  background: ${gradients.amethyst};

  & img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const PostInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 24px 28px;
`

export const PostMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

export const PostCategory = styled.span`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: ${colors.dclRed};
`

export const PostDate = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${colors.muted2};
`

export const PostTitle = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  color: ${colors.softWhite};
`
