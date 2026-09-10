import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export const Methods = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  padding: 0 2px;
`

export const Card = styled.label`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px;
  border: 1px solid ${theme.colors.softWhite};
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.glassFaint};
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover:not([data-disabled]) {
    background: ${theme.colors.glass};
  }
  &[data-selected] {
    border-color: transparent;
    background: ${theme.colors.glass};

    &::before {
      content: '';
      position: absolute;
      inset: -2px;
      padding: 3px;
      border-radius: 13px;
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
    cursor: default;

    & img {
      opacity: 0.5;
    }
  }

  & input {
    visibility: hidden;
    position: absolute;
  }
`

export const Mark = styled.img`
  flex: none;
  width: 36px;
  height: 36px;
  object-fit: contain;
`

export const Info = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

export const Title = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${theme.colors.softWhite};
`

export const Balance = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray4};

  & span {
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: ${theme.colors.softWhite};
  }
`

export const Price = styled.span`
  position: relative;
`

export const Amount = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 20px;
  font-weight: 600;
  color: ${theme.colors.softWhite};
`

export const Rate = styled.span`
  position: absolute;
  top: 100%;
  right: 0;
  width: max-content;
  font-size: 12px;
  color: ${theme.colors.gray4};
`
