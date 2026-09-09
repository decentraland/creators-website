import styled from '@emotion/styled'
import { Link } from 'react-router-dom'
import { CollectionRolePill } from '~/components/CollectionRolePill'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')
const desktop = theme.media.minWidth('mobile')

export const Card = styled(Link)`
  position: relative;
  height: 318px;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  border-radius: ${theme.radius.cardLg};
  overflow: hidden;
  cursor: pointer;
  filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.04));
  transition: box-shadow 0.15s ease;

  /* Inner 2px gradient border: gradient layer with the padding-box masked out. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 2px;
    background: ${theme.gradients.cerise};
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &:hover,
  &:active,
  &:focus-visible {
    box-shadow: 0 0 8px ${theme.colors.brandViolet};
    outline: none;

    &::after {
      opacity: 1;
    }
  }

  ${desktop} {
    &:hover,
    &:focus-visible {
      & [data-testid='collection-card-items'],
      & [data-testid='collection-card-updated'] {
        display: none;
      }
      & [data-testid='collection-card-manage'] {
        display: flex;
      }
    }
  }

  ${mobile} {
    flex-direction: row;
    height: 136px;
    border-radius: ${theme.radius.card};
    background: ${theme.colors.overlay};
  }
`

export const Media = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;

  ${mobile} {
    flex: none;
    width: 136px;
    height: 100%;
  }
`

export const RoleBadge = styled(CollectionRolePill)`
  position: absolute;
  right: 8px;
  bottom: 8px;
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
    padding: 16px 12px 16px 16px;

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

export const Manage = styled.span`
  display: none;
  align-items: center;
  justify-content: center;
  /* Same height as the two meta lines it replaces, so the footer doesn't jump. */
  height: 52px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.text};
  color: ${theme.colors.white};
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.46px;
  text-transform: uppercase;
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
