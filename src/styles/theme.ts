// Design tokens for the Emotion `styled` layer (shop's palette — the two apps share one visual identity).
// Import this object directly and interpolate it — `styled.span\`color: ${theme.colors.muted}\``,
// `theme.media.maxWidth('mobile')`. It's a plain const, so no ThemeProvider is needed; this also keeps
// unit tests provider-free. Components must NOT re-hardcode hexes, radii, or px breakpoints.

const colors = {
  bg: '#ffffff',
  text: '#161518', // Neutrals/Soft Black 1
  text2: '#242129', // Neutrals/Soft Black 2
  muted: '#716b7c', // Neutrals/Gray 2
  muted1: '#5e5b67', // Neutrals/Gray 1
  muted2: '#a09ba8', // Neutrals/Gray 3
  gray0: '#43404a', // Neutrals/Gray 0
  gray4: '#cfcdd4', // Neutrals/Gray 4
  textSecondary: 'rgba(22, 21, 24, 0.6)',
  line: '#e6e4ea',
  lineStrong: '#a09ba8',
  // Gray 3 @ 25%: the only way a hairline reads equally faint over both white and grey surfaces.
  cardLine: 'rgba(160, 155, 168, 0.25)',
  media: '#ecebed', // Neutrals/Gray 5
  panel: '#f5f5f5',
  chip: '#ecebed',
  accent: '#691fa9',
  accentHover: '#7a2bbf',
  accentActive: '#57178c',
  magenta: '#c640cd',
  brandViolet: '#a524b3',
  softWhite: '#fcfcfc',
  dclRed: '#ff2d55',
  dclRedHover: '#ff4269',
  ok: '#1ea672',
  err: '#d33',
  okStrong: '#1f8a4c',
  errStrong: '#d64545',
  errLight: '#FB3B3B',
  errOverlay: 'rgba(255, 0, 0, 0.05)',
  success: '#00b453',
  successBorder: '#34ce77',
  green: '#30cd00', // DCL/Green — published status
  amber: '#ffbc5b', // Brand/Amber — under-review status, warm gradient stop
  orangeStrong: '#f48221', // under-review pill fill (at 20%)
  redRejected: '#cc1d2c', // rejected pill fill (at 20%)
  redBright: '#ff0404', // rejected pill border/text
  orange: '#ff7439', // Brand/Orange — active tab underline, warm accents
  // Inline validation warnings on dark surfaces (Figma System/Warning).
  warningOverlay: 'rgba(255, 207, 137, 0.2)',
  warningText: '#ffe1b7',
  white: '#ffffff',
  // Hairline on a translucent field over the purple (search box border).
  fieldBorder: '#c6bcd7',
  // Translucent overlays for dark surfaces (panels, card footers, empty-state shells).
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
  overlayStrong: 'rgba(0, 0, 0, 0.6)',
  // Full-screen modal scrim.
  scrim: 'rgba(0, 0, 0, 0.8)',
  overlayHover: 'rgba(0, 0, 0, 0.55)',
  chipDark: 'rgba(0, 0, 0, 0.3)',
  // Modal surface: the solid deep purple dialogs sit on (Figma "Create Collection Modal").
  modalSurface: '#4c147c',
  // System/info blues (Figma "Status Tab" draft variant).
  info: '#1764c0',
  infoLight: '#63b4f6',
  infoLighter: '#bbdefb',
  // Sub-nav band: translucent deep purple (#401458, shop's designer value), deepening on scroll.
  subnavOverlay: 'rgba(64, 20, 88, 0.2)',
  subnavOverlayScrolled: 'rgba(64, 20, 88, 0.8)',
  // Translucent white fills for controls on dark surfaces (filter pills, search bars, buttons).
  glass: 'rgba(255, 255, 255, 0.2)',
  glassFaint: 'rgba(255, 255, 255, 0.1)',
  glassHover: 'rgba(255, 255, 255, 0.3)',
  glassLine: 'rgba(255, 255, 255, 0.5)',
  // Legendary's light gradient stop (#A657ED) is too close to the purple surfaces; lift it for the pill text.
  rarityLegendaryLight: '#e8b9ff',
  // Overview page (sites' creator landing values, kept exact for visual parity).
  apricot: '#ffa25a', // resource links over the dark create cards
  offWhite: '#f0f0f0', // decentraland-ui2 dark scheme text.primary: FAQ frame, answers, CTA border
  offWhiteMuted: 'rgba(240, 240, 240, 0.7)', // ui2 dark text.secondary: FAQ subtitle and questions
  gray0Half: 'rgba(67, 64, 74, 0.5)', // Gray 0 @ 50%: create card info blocks
  inkFade: 'rgba(24, 20, 26, 0.8)', // testimonials grid fading into the wings
  badgeOverlay: 'rgba(0, 0, 0, 0.65)', // live scene "online" pill
  online: '#3fb950', // live scene pill dot
  dclRedLine: 'rgba(255, 45, 85, 0.5)', // MUI outlined-primary border (light button)
  glassHint: 'rgba(255, 255, 255, 0.08)', // MUI dark action.hover (ghost button)
  glassGlow: 'rgba(255, 255, 255, 0.15)', // active carousel slide halo
  glassStrong: 'rgba(255, 255, 255, 0.4)' // idle carousel dot
} as const

// Per-rarity design colors (Figma "Rarities/*", shop's palette). Distinct from @dcl/schemas' Rarity.getColor:
// the designer re-tuned every one for the dark field.
const rarities = {
  common: '#73d3d3',
  uncommon: '#ff8362',
  rare: '#34ce76',
  epic: '#289cff',
  legendary: '#a24bf3',
  exotic: '#9cd71e',
  mythic: '#ff4bed',
  unique: '#fea217'
} as const

const gradients = {
  amethyst: 'linear-gradient(180deg, #c640cd 0%, #691fa9 100%)',
  cerise: 'linear-gradient(135deg, #ff2d55 0%, #c640cd 100%)',
  flare: 'linear-gradient(157.44deg, #ffbc5b 0%, #ff2d55 50.52%, #c640cd 100%)',
  ember: 'linear-gradient(69deg, #ffbc5b 0%, #ff2d55 100%)',
  coral: 'linear-gradient(90deg, #ff7439 0%, #ff2d55 100%)',
  // Overview page (sites' creator landing gradients, exact stops).
  orchid: 'linear-gradient(206deg, #c640cd 2.47%, #691fa9 98.81%)', // "join" why card, blog cover fallback
  apricot: 'radial-gradient(2917.83% 156.44% at 16.06% 114.57%, #ff4f57 13.42%, #ffa25a 100%)', // "create" why card
  raspberry: 'linear-gradient(208deg, #ff2d55 13.94%, #c640cd 80.96%)', // "benefit" why card
  sunrise: 'linear-gradient(244deg, #ff2d55 -11.67%, #ffbc5b 88.23%)', // section title highlight
  dawn: 'linear-gradient(287deg, #ff2d55 5.21%, #ffbc5b 56.5%)', // hero title highlight
  dusk: 'linear-gradient(90deg, #43404a 0%, #691fa9 100%)' // FAQ row hover sweep
} as const

// Item editor workspace (creator-hub inspector palette; no other hexes belong in the editor).
const editor = {
  bg: colors.text,
  surface: colors.text2,
  surfaceHover: colors.muted1,
  label: colors.muted2,
  accent: colors.dclRed,
  line: colors.gray0
} as const

const radius = {
  card: '12px',
  cardLg: '16px',
  chip: '4px',
  input: '6px',
  btn: '12px',
  btnSm: '8px',
  pill: '50px',
  banner: '24px',
  modal: '16px',
  dropzone: '20px'
} as const

const font = {
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  // MUI Typography's body tracking; the overview page carries it on every text block sites set in Typography.
  tracking: '0.00938em'
} as const

// Stacking tiers. `overlay` sits above the global DCL navbar (position: fixed) + the sub-nav so a
// full-screen scrim dims the whole viewport; `tooltip` clears any overlay (tooltips portal to <body>).
const z = {
  overlay: 10000,
  prompt: 10005,
  tooltip: 10010
} as const

// Canonical breakpoints — reuse these, don't invent new ones. `mobile` (768) is the primary one.
// Deliberately NOT a key on `theme`: MUI (via decentraland-ui2) already owns a `breakpoints` key on
// Emotion's augmented `Theme`. Use `theme.media.*` instead.
export const breakpoints = {
  mobile: 768,
  sm: 720,
  md: 820,
  lg: 900,
  xl: 1200,
  // decentraland-ui2's MUI breakpoints (sm/md/lg), which the overview page inherits from sites.
  tablet: 991,
  laptop: 1024,
  desktop: 1280
} as const

export type Breakpoint = keyof typeof breakpoints

const media = {
  maxWidth: (bp: Breakpoint) => `@media (max-width: ${breakpoints[bp]}px)`,
  // Exact complement of maxWidth. `min-width: bp + 1` leaves a gap for fractional viewport widths
  // (browser zoom, DPR scaling) where neither query matches and unstyled layout leaks through.
  minWidth: (bp: Breakpoint) => `@media not all and (max-width: ${breakpoints[bp]}px)`,
  /** Below this width the app is a viewer: header buttons and row menus that manage collections are hidden. */
  noActions: `@media (max-width: ${breakpoints.lg}px)`,
  /** Exact complement of `noActions`: the table layouts with their actions column. */
  withActions: `@media not all and (max-width: ${breakpoints.lg}px)`
}

export const theme = { colors, rarities, gradients, radius, font, media, z, editor }

export type AppTheme = typeof theme
