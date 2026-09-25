import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SectionTitle } from '../OverviewPage.styles'

export { Centered, ViewAllLink } from '../OverviewPage.styles'

const { colors, font, gradients, media } = theme

const laptop = media.maxWidth('laptop')

export const Section = styled.section`
  position: relative;
  width: 100%;
  padding: 40px 0 100px;
  overflow: hidden;
`

export const Title = styled(SectionTitle)`
  margin-bottom: 62px;
`

export const Posts = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 0 100px;

  ${laptop} {
    justify-content: flex-start;
    padding: 0 16px;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`

export const PostCard = styled.a`
  display: flex;
  flex-direction: column;
  flex-shrink: 1;
  width: 380px;
  min-width: 300px;
  border-radius: 20px;
  background: ${colors.text2};
  color: ${colors.white};
  overflow: hidden;
  cursor: pointer;
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

  ${laptop} {
    flex-shrink: 0;
    width: 300px;
  }
`

export const PostImage = styled.div`
  width: 100%;
  height: 200px;
  background: ${gradients.orchid};

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
  line-height: 1.5;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: ${colors.dclRed};
`

export const PostDate = styled.span`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: ${font.tracking};
  color: ${colors.muted2};
`

export const PostTitle = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  letter-spacing: ${font.tracking};
  color: ${colors.softWhite};
`
