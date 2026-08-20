import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Card = styled.article`
  height: 318px;
  display: flex;
  flex-direction: column;
  border-radius: ${theme.radius.cardLg};
  overflow: hidden;
  cursor: pointer;
  filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.04));
  transition: box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    box-shadow: 0 0 8px 2px ${theme.colors.brandViolet};
    outline: none;
  }

  ${mobile} {
    flex-direction: row;
    height: 128px;
    border-radius: ${theme.radius.card};
    background: ${theme.colors.overlay};
  }
`

export const Media = styled.div`
  flex: 1;
  min-height: 0;

  ${mobile} {
    flex: none;
    width: 128px;
    height: 100%;
  }
`

export const Body = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 16px 16px;
  background: ${theme.colors.overlay};

  ${mobile} {
    flex: 1;
    min-width: 0;
    justify-content: center;
    background: none;
    padding: 12px 16px;

    /* The design stacks name / items / status / updated on mobile. */
    & [data-testid='collection-card-items'] {
      order: 1;
    }
    & [data-testid='collection-status'] {
      order: 2;
      align-self: flex-start;
    }
    & [data-testid='collection-card-updated'] {
      order: 3;
    }
  }
`

export const NameRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;

  ${mobile} {
    display: contents;
  }
`

export const Name = styled.h3`
  margin: 0;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.6;
  color: ${theme.colors.white};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const Meta = styled.span`
  font-size: 14px;
  line-height: 1.57;
  color: ${theme.colors.gray4};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${mobile} {
    font-size: 13px;
  }
`
