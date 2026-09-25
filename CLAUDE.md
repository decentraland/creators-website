# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**creators-website** is the new UI for Decentraland **wearables and emotes creators**: a modern front end (better UX, new creator tools) on top of the existing, unchanged **builder-server** back end. Feature designs and mockups live in Figma.

Consistency rule: this app deliberately shares its tech stack and visual identity (theme, color palette) with the **shop** repo. Day-to-day code needs only this file and `CONVENTIONS.md` — do **not** consult shop for regular tasks. Check what shop uses only when making a _new_ technology choice (adding a dependency, a tool, a pattern for a problem this repo hasn't solved yet), and prefer shop's choice unless there's a strong reason not to.

## Tech stack

Ported from shop's config:

- **Core:** Vite + React 18 + TypeScript strict, React Router v6, `~` → `src/` path alias.
- **State:** `@tanstack/react-query` for server state (builder-server data), `zustand` for client/session state. No redux.
- **Styling:** Emotion `styled` + a `src/styles/theme.ts` token file (shop's palette), `decentraland-ui2` (MUI-based) where it fits. The item editor's resizable columns use `react-resizable-panels` (creator-hub inspector's choice).
- **i18n:** `react-intl` with `en.json` / `es.json`.
- **Auth:** `decentraland-connect` + `@dcl/single-sign-on-client` + a zustand wallet store; builder-server requests signed with `@dcl/crypto` AuthChain.
- **Monitoring:** Sentry (`@sentry/react`).
- **Tests:** Vitest + Testing Library for unit tests (`vitest.config.ts`, jsdom); Puppeteer + Vitest for e2e (e2e setup pending).
- **Deploy:** Decentraland CDN convention (`prebuild.cjs`, env per hostname); Vercel is used for PR/dev previews only.
- **Out of scope** (shop features that do not carry over): Stripe/thirdweb/credits/checkout, cart/favorites/follows, fitting room.

## Commands

Current commands (keep this section in sync with `package.json`):

- `npm run start` (or `npm run dev`) — Vite dev server
- `npm run build` — `tsc -b` type-check + Vite build (runs `scripts/prebuild.cjs` first)
- `npm run typecheck` — `tsc -b` only
- `npm run test` — run all Vitest tests once; `npm run test:watch` for watch mode; `npm run test:coverage` for coverage
- `npx vitest run src/path/to/file.spec.ts` — run a single test file; add `-t 'name'` to filter by test name
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, `eslint.config.js`) over `src`
- `npm run format` — Prettier check; `npm run format:fix` — write (rules in `.prettierrc`)

Node >= 24 required. Pre-commit (simple-git-hooks + nano-staged, installed on `npm install`) runs `eslint --fix` + `prettier --write` on staged files and a project-wide typecheck.

## Architecture

### App boundaries: the creator home lives in `sites`

This SPA does **not** own the creator home ("Overview") page: that page is implemented in the separate **sites** repo and served at `decentraland.org/create` (`.zone`/`.today` per environment). This app owns the collections surfaces and is mounted on the same domain under its own path, so the two apps feel like one: both render the same restyled `decentraland-ui2` navbar + sub-nav treatment, and identity is shared via SSO. Cross-app navigation is a plain full-page link, never a router route:

- The navbar's **Overview** tab links to `CREATE_URL` from the env config (`src/config/env/*.json`).
- **Scenes** and **Land** tabs link to the legacy builder at `BUILDER_URL`.
- On the sites side, the create page's "Collections" navigation links back into this app.

Don't re-add an overview/home page here — it was intentionally removed; `/overview` survives only as a redirect to `/collections` for old links.

Item editor (`/collections/editor`, spec `design/ITEM_EDITOR_SPEC.md`): the shared `~/components/AvatarPreview` mounts ui2's `WearablePreview` once with a frozen URL snapshot and pushes every later change through `lib/previewBridge` (postMessage UPDATE), so avatar/item changes never reload the iframe. The renderer is decided per mount by `lib/pickRenderer` (`unity-wearable-preview` flag via `lib/featureFlags`, `?unity=false` override resolved in `src/config`). Model checks go through the swappable `lib/validation` module (README inside); spring bone physics through `lib/springBones`.

Entry: `index.html` → `src/main.tsx` (creates the `BrowserRouter`, the single router call site — see `CONVENTIONS.md` — with `basename` from `~/config`) → `src/App.tsx` (declares the routes: `React.lazy` pages + `<Routes>`). Page components live in `src/components/` (`components/CollectionsPage`, …), one per route. Component organization is semantic — see "Component organization" in `CONVENTIONS.md`. Zustand stores in `src/store/`; business logic (API clients, flows, encoding) in `src/lib/` — heavily unit-tested, never in components; react-query hooks in `src/hooks/`; i18n provider and messages in `src/intl/`.

### Environment configuration (`@dcl/ui-env`)

Runtime config lives in `src/config/index.ts`, built from per-environment JSON files in `src/config/env/` (`dev.json`, `stg.json`, `prd.json`). One build serves every environment: `@dcl/ui-env` resolves it per deployed site (.zone → dev, .today → stg, .org → prd), overridable at runtime with `?env=` (e.g. `?env=prod`), and locally via `VITE_DCL_DEFAULT_ENV` in `.env` (copy `.env.default`). Config values (URLs, API endpoints, feature settings) belong in these JSON files, never hardcoded — and the JSON files hold only PUBLIC, client-safe values, **never a real secret**.

### Build/deploy plumbing

`scripts/prebuild.cjs` runs before every build: it syncs the version from `package.json` into `public/package.json` and computes `VITE_BASE_URL` — empty for local builds, `https://cdn.decentraland.org/<name>/<version>` in CI — rewriting `.env` and both package.json `homepage` fields in place. Vite uses `VITE_BASE_URL` as `base` for production builds only.

Releases: `.github/workflows/build-release.yml` (push to `main`, GitHub release, or manual dispatch) publishes `dist/` as the `@dcl/creators-site` npm package and triggers the CDN deploy; `set-rollout.yml` then points `.zone` and `.today` at it. Production (`.org`) is promoted by hand with `set-rollout-manual.yml` from an already-published version. Source maps upload to Sentry only when `SENTRY_AUTH_TOKEN` is set and are deleted before publish.

## Design specs are the source of truth

Feature behavior is specified in `design/*.md` before/alongside implementation, fed from the Figma mockups. Before changing a flow, read the matching spec. Code/copy rules live in `CONVENTIONS.md`.

The spec for all of Decentraland's public APIs is available at https://docs.decentraland.org/apis — consult it when integrating with or debugging any Decentraland API.

## Conventions

### i18n (hard rule)

Every user-facing string — buttons, labels, headings, placeholders, statuses, errors, tooltips, empty states — goes through `t('a.b.c')` with a key added to **both** `en.json` and `es.json`. Never hardcode a display string in a component; this is part of "done" for any UI change. Spanish uses neutral (Latin American) **"tú"** forms, never "vos" ("Inicia sesión", not "Iniciá").

### Copy (relaxed web2-first)

Prefer friendly copy and hide blockchain plumbing where possible. Wallet/MANA/transaction terms are allowed where the flow genuinely requires them (publishing, fees) — creators are a crypto-aware audience. Never surface a raw error to the user: report it to Sentry and show human-friendly copy.

### Styling

- Every component is a folder — `components/Foo/{Foo.tsx, Foo.styles.ts, Foo.spec.tsx, index.ts}` — with `index.ts` re-exporting so consumers import `~/components/Foo`. Styled defs live in the `.styles.ts` file (`import * as S from './Foo.styles'`); a tiny single-use def may stay inline.
- Pull colors/radii/breakpoints from the theme, never re-hardcode hexes or pixel breakpoints. **Import the theme directly** (`import { theme } from '~/styles/theme'`), never via ThemeProvider or `({ theme }) =>` callbacks — there is no runtime theming, and the direct import keeps unit tests provider-free.
- Media queries via `theme.media.maxWidth(bp)` / `.minWidth(bp)`; raw `@media` strings only for genuinely non-canonical values.
- State and variants are `data-*` attributes (`data-open`, `data-variant`, `data-selected`) styled via `&[data-…]` selectors — never `is-*`/BEM-modifier classNames.
- **Buttons**: every action button/link is `~/components/Button` (`variant` / `size` / `loading`, polymorphic `as`). Layout-only tweaks go through `styled(Button)`; never re-declare a button's colors or variants in a page's styles.
- **Icons**: Material glyphs from `@mui/icons-material`; Figma-specific glyphs as inline-SVG components in `~/components/Icons` — see "Icons" in `CONVENTIONS.md`.
- **Never use a styled component as a selector** inside another styled template (`${Name} { … }`): it compiles in the Vite build but throws in Vitest. Target a stable `[data-testid]` / `[data-*]` hook instead.

### Feature flags

Decentraland's flag service is read through `lib/featureFlags` (one `FeatureFlag` enum entry plus its owning application, `builder` or `dapps`) and consumed with `useFeatureFlag(flag)` → `{ enabled, isLoading }`. Reads fail closed: a flag still loading, absent, or unreachable is off. Add a flag by adding the enum entry and its `APPLICATION` row — never by fetching the service anywhere else. Locally, override with `VITE_FEATURE_FLAG_OVERRIDES=unity-wearable-preview:true`. In specs, mock `~/lib/featureFlags` onto `~/test/featureFlags` and declare the flags the subject runs with via `setFeatureFlags(...)`.

### Testing

Unit tests for the logic layer, e2e for user flows.

- Unit tests are colocated with their subject (`foo.spec.ts` next to `foo.ts`). `lib/` and `store/` are the well-covered logic layer — every module there gets unit tests. Pages get no unit tests; they're covered by e2e.
- **Components with logic get unit tests.** Purely presentational/atomic components don't need them; any component carrying real behavior does.
- **Every user-facing flow has an e2e test** covering its happy path — this is part of "done" for a feature. E2E tests drive the built app in a real headless browser with wallet, network, and HTTP fully mocked — never introduce a real network call or real key.
- **Test functionality, not implementation (hard rule).** Write tests from the user's / use-case perspective: given this input or action, this observable outcome. Never assert on internals (call order, private state shape, intermediate steps) that a refactor could change without changing behavior. After a refactor, don't add or keep tests pinned to the old implementation's specifics — if a test breaks while behavior didn't, rewrite or delete it rather than patching it to match the new internals. Fewer meaningful use-case tests beat many noisy atomic ones.
- **Select by `data-testid`, never by CSS class (hard rule).** Add a stable `data-testid` and select on `[data-testid="…"]`; for stateful/variant elements assert on `data-*` attributes. Styling class names are presentational and change with the design.

### Analytics and error reporting (part of every feature plan)

Every feature plan and spec includes an analytics section before implementation starts: the funnel of the feature's usage (entry → key steps → outcome) or the product metrics that match its business impact, as Segment events through `lib/analytics#track`, with names and props recorded in `design/TRACKING_SPEC.md` in the same change. Where a step can fail in a way the team must know about (a request the user can't recover from, a data or schema mismatch, an unexpected throw), report it to Sentry through `lib/monitoring#captureError` with a `flow` tag; expected states the user can fix themselves (offline, permission denied, validation warnings) are tracked as events, not errors. A feature without its events and error reporting is not "done".

### Responsive (standing requirement)

Every feature or edit must work on mobile as well as desktop — responsive behavior is part of "done" for any UI change. Verify at a narrow viewport (≤ 768px, the primary mobile breakpoint) as well as desktop; keep touch targets ~44px; hover-only affordances need a tap/focus equivalent; anchored overlays must not spill off-screen on narrow widths.
