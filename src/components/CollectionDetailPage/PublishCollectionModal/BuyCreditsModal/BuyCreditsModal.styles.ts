import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0 0;
`

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
`

export const Heading = styled.h3`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.white};
`

export const Balance = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};

  & span {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 600;
  }
`

export const Packs = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 16px 2px 0;

  ${theme.media.maxWidth('lg')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 28px;
  }
`

// A tile is a whole-card button; the stepper inside it stops the click so it does not double as a select.
export const Pack = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 12px 16px;
  border: 1px solid ${theme.colors.glassLine};
  border-radius: ${theme.radius.cardLg};
  background: ${theme.colors.overlayLight};
  color: ${theme.colors.white};
  text-align: center;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: ${theme.colors.glassFaint};
  }

  &[data-selected] {
    border-color: transparent;
    background: ${theme.colors.accent};

    &::before {
      content: '';
      position: absolute;
      inset: -2px;
      padding: 3px;
      border-radius: 18px;
      background: ${theme.gradients.ember};
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      mask-composite: exclude;
      pointer-events: none;
    }
  }

  &[data-disabled] {
    pointer-events: none;
    opacity: 0.7;
  }

  &[data-skeleton] {
    cursor: default;
    pointer-events: none;
  }

  ${mobile} {
    padding: 20px 8px 12px;
  }
`

export const SkeletonLine = styled.span`
  display: block;
  height: 16px;
  width: 64px;

  &[data-size='amount'] {
    height: 28px;
    width: 80px;
  }
  &[data-size='label'] {
    height: 12px;
    width: 56px;
  }
  &[data-size='price'] {
    height: 20px;
    width: 64px;
  }
`

export const SkeletonArt = styled.span`
  display: block;
  width: 96px;
  height: 96px;
  border-radius: ${theme.radius.card};

  ${mobile} {
    width: 72px;
    height: 72px;
  }
`

export const Badge = styled.span`
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px 4px 8px;
  border-radius: ${theme.radius.pill};
  background: ${theme.gradients.flare};
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  color: ${theme.colors.white};
  white-space: nowrap;

  & svg {
    font-size: 14px;
  }
`

export const Credits = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`

export const CreditsAmount = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
`

export const CreditsLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${theme.colors.softWhite};
`

export const Art = styled.img`
  width: 96px;
  height: 96px;
  object-fit: contain;

  ${mobile} {
    width: 72px;
    height: 72px;
  }
`

export const Price = styled.span`
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
`

export const Stepper = styled.div`
  display: inline-flex;
  align-items: stretch;
  height: 36px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlayStrong};
  overflow: hidden;

  & > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.white};
  }
`

export const StepButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  border: 0;
  background: ${theme.colors.glassFaint};
  color: ${theme.colors.white};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.glass};
  }

  &:disabled {
    color: ${theme.colors.muted2};
    cursor: default;
  }

  & svg {
    font-size: 16px;
  }
`

export const Total = styled.p`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};

  & span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    color: ${theme.colors.white};
  }
`

export const ErrorText = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  text-align: right;
  color: ${theme.colors.errLight};
`

export const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid ${theme.colors.glassHover};

  & > button {
    min-width: 250px;
  }

  ${mobile} {
    flex-direction: column-reverse;

    & > button {
      min-width: 0;
    }
  }
`
