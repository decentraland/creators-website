import styled from '@emotion/styled'
import { breakpoints, theme } from '~/styles/theme'

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
  /* Same band as sites' sub-tab bar (events AdminTabsBar): 56px tall with 16px sides, 64px tall with
     64px sides from ui2's md breakpoint (min-width: 1024px inclusive, which media.minWidth can't
     express). Keep the height in sync with --sub-nav-h in styles/index.css. */
  height: 56px;
  padding: 0 16px;
  background: ${colors.subnavOverlay};
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  @media (min-width: ${breakpoints.laptop}px) {
    height: 64px;
    padding: 0 64px;
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
