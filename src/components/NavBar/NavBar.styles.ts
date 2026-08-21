import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const { colors, media } = theme

const mobile = media.maxWidth('mobile')

export const Subnav = styled.div`
  position: sticky;
  /* Pinned under the ui2 navbar — see --nav-h in styles/index.css for why this is a var and not
     a pair of numbers on our own breakpoint. */
  top: var(--nav-h);
  z-index: 40;
  display: flex;
  align-items: center;
  height: 64px;
  /* 54px matches the ui2 Navbar's desktop side padding so the sub-nav aligns with the top nav. */
  padding: 0 54px;
  /* Translucent deep-purple band over the page field, hairline white divider. 20% at rest, deepening
     once the page scrolls so the bar doesn't wash out over light content passing underneath — the same
     treatment the top nav carries. */
  background: ${colors.subnavOverlay};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  transition: background 0.25s ease;

  &[data-scrolled] {
    background: ${colors.subnavOverlayScrolled};
  }

  ${mobile} {
    padding: 0 16px;
  }
`

export const Tabs = styled.nav`
  display: flex;
  gap: 40px;
  height: 100%;
  /* The links are nowrap, so without min-width: 0 the strip's min-content width is rigid and pushes
     the page into horizontal overflow on narrow viewports. It scrolls instead — the mask on its right
     edge is what tells you there is more to reach, since the scrollbar is hidden. */
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  & a {
    display: flex;
    align-items: center;
    height: 100%;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 15px;
    font-weight: 600;
    color: ${colors.muted2};
    border-bottom: 4px solid transparent;
  }
  & a:hover {
    color: ${colors.white};
  }
  & a.active {
    color: ${colors.white};
    border-bottom-color: ${colors.orange};
  }

  ${mobile} {
    gap: 16px;
    mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);

    & a {
      font-size: 12px;
      letter-spacing: 0.038em;
    }
  }
`
