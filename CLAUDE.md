# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**creators-website** is the new UI for Decentraland **wearables and emotes creators**: a modern front end (better UX, new creator tools) on top of the existing, unchanged **builder-server** back end. Feature designs and mockups live in Figma.

Consistency rule: this app deliberately shares its tech stack and visual identity (theme, color palette) with the **shop** repo. Day-to-day code needs only this file and `CONVENTIONS.md` — do **not** consult shop for regular tasks. Check what shop uses only when making a _new_ technology choice (adding a dependency, a tool, a pattern for a problem this repo hasn't solved yet), and prefer shop's choice unless there's a strong reason not to.

## Tech stack

Ported from shop's config:

- **Core:** Vite + React 18 + TypeScript strict, React Router v6, `~` → `src/` path alias.
- **State:** `@tanstack/react-query` for server state (builder-server data), `zustand` for client/session state. No redux.
- **Styling:** CSS Modules over design tokens as custom properties (`src/styles/tokens.css`, generated from the `src/styles/theme.ts` token file: shop's palette); files not yet converted still use Emotion `styled`. `decentraland-ui2` (MUI-based) where it fits. The item editor's resizable columns use `react-resizable-panels` (creator-hub inspector's choice).
- **i18n:** `react-intl` with `en.json` / `es.json` / `zh.json`.
- **Auth and chain:** `decentraland-connect` + `@dcl/single-sign-on-client` + a zustand wallet store; builder-server requests signed with `@dcl/crypto` AuthChain; on-chain reads, writes and typed-data signatures through `viem`.
- **Monitoring:** Sentry (`@sentry/react`).
- **Tests:** Vitest + Testing Library for unit tests (`vitest.config.ts`, jsdom); Puppeteer + Vitest for e2e (`vitest.e2e.config.ts`, `e2e/`).
- **Deploy:** Decentraland CDN convention (`prebuild.cjs`, env per hostname); Vercel is used for PR/dev previews only.
- **Out of scope** (shop features that do not carry over): thirdweb, cart/favorites/follows, fitting room.

## Commands

Current commands (keep this section in sync with `package.json`):

- `npm run start` (or `npm run dev`) — Vite dev server
- `npm run build` — `tsc -b` type-check + Vite build (runs `scripts/prebuild.cjs` first)
- `npm run typecheck` — `tsc -b` only
- `npm run tokens` — regenerate `src/styles/tokens.css` from `src/styles/theme.ts` (a spec fails while it is stale)
- `npm run test` — run all Vitest tests once; `npm run test:watch` for watch mode; `npm run test:coverage` for coverage
- `npx vitest run src/path/to/file.spec.ts` — run a single test file; add `-t 'name'` to filter by test name
- `npm run test:e2e` — browser e2e suite; starts its own Vite dev server on port 5283 (`E2E_PORT=<port>` to move it). One spec: `npm run test:e2e -- e2e/collections.e2e.ts`. Chrome comes from Puppeteer's postinstall; after an `--ignore-scripts` install run `npx puppeteer browsers install chrome`
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, `eslint.config.js`) over `src`
- `npm run format` — Prettier check; `npm run format:fix` — write (rules in `.prettierrc`)

Node >= 24 required. Pre-commit (simple-git-hooks + nano-staged, installed on `npm install`) runs `eslint --fix` + `prettier --write` on staged files and a project-wide typecheck.

## Architecture

### App boundaries: served by path at `/create`

This SPA is the creator surface of decentraland.org: it is served **by path** at `decentraland.org/create` (`.zone`/`.today` per environment), the router's `basename` is `/create` whenever the page URL starts with it (`src/config/index.ts`, `resolveBasePath`) and `/` otherwise (local dev, Vercel previews), so one build works in both. It owns the creator home ("Overview", `components/OverviewPage`) at `/` and the collections surfaces under `/collections`; `/overview` survives only as a redirect to `/` for old links. The overview's outbound destinations (places, blog, Creator Hub download, docs, Discord) are plain full-page links built from `SITES_URL` / `DOCS_URL` / `DISCORD_URL` in the env config, never router routes:

- **Scenes** and **Land** tabs link to the legacy builder at `BUILDER_URL`.
- The hot-scenes rail reads `HOT_SCENES_URL`; the blog rail reads the Contentful CMS (`CMS_API_URL` + space + environment).

Item editor (`/collections/editor`): every preview (avatar, thumbnail editor, add-items draft processing) and its emote/translation controls go through `~/components/WearablePreview`, the app-owned preview interface (`types.ts`); its one implementation, `WearablePreview.tsx`, wraps decentraland-ui2's component of the same name and is the only preview code that imports ui2, so another renderer replaces that file alone. The shared `~/components/AvatarPreview` mounts the preview once with a frozen URL snapshot and pushes every later change through `lib/previewBridge` (postMessage UPDATE), so avatar/item changes never reload the iframe. The renderer is decided per mount by `lib/pickRenderer` (`unity-wearable-preview` flag via `lib/featureFlags`, `?unity=false` override resolved in `src/config`). Model checks go through the swappable `lib/validation` module (README inside); spring bone physics through `lib/springBones`.

Curation (`/curation`): committee members, per `useCommittee` (`GET /committee`, fails closed), get the Curation tab and review collections in the item editor with `?reviewing=true`: a read-only review mode that only committee members get (anyone else sees the regular editor under their own permissions). Committee chain writes go through `lib/collectionApproval` (`Committee.manageCollection`); the approval flow lives in `lib/approveCollection` and Catalyst entities in `lib/catalystEntity`, whose metadata key order is part of the content hash.

Chain: `lib/auth` is the only way to read, send or sign. Its eager part restores the session and answers the navbar's network reads and switches with raw EIP-1193 requests; viem's clients (a wallet client over the session's provider for sends and signatures, public RPC clients for reads) are built only in its lazily loaded modules, which the index's async wrappers import on first use. `lib/chain` holds the contract registry (address, EIP-712 domain, meta-transaction style and ABI per contract and chain) and the gasless meta-transaction path through the relayer, which `lib/auth` takes only after checking that the wallet's active account is the session's.

Entry: `index.html` → `src/main.tsx` (creates the `BrowserRouter`, the single router call site — see `CONVENTIONS.md` — with `basename` from `~/config`) → `src/App.tsx` (declares the routes: `React.lazy` pages + `<Routes>`). Page components live in `src/components/` (`components/CollectionsPage`, …), one per route. Component organization is semantic — see "Component organization" in `CONVENTIONS.md`. Zustand stores in `src/store/`; business logic (API clients, flows, encoding) in `src/lib/` — heavily unit-tested, never in components; react-query hooks in `src/hooks/`; i18n provider and messages in `src/intl/`.

### Environment configuration (`@dcl/ui-env`)

Runtime config lives in `src/config/index.ts`, built from per-environment JSON files in `src/config/env/` (`dev.json`, `stg.json`, `prd.json`). One build serves every environment: `@dcl/ui-env` resolves it per deployed site (.zone → dev, .today → stg, .org → prd), overridable at runtime with `?env=` (e.g. `?env=prod`), and locally via `VITE_DCL_DEFAULT_ENV` in `.env` (copy `.env.default`). Config values (URLs, API endpoints, feature settings) belong in these JSON files, never hardcoded — and the JSON files hold only PUBLIC, client-safe values, **never a real secret**.

### Build/deploy plumbing

`scripts/prebuild.cjs` runs before every build: it syncs the version from `package.json` into `public/package.json` and computes `VITE_BASE_URL` — empty for local builds, `https://cdn.decentraland.org/<name>/<version>` in CI — rewriting `.env` and both package.json `homepage` fields in place. Vite uses `VITE_BASE_URL` as `base` for production builds only.

Releases: `.github/workflows/cdn-deploy.yml` uploads `dist/` to the CDN as `@dcl/creators-site` through `decentraland/actions/cdn-deploy`. Every push to `main` deploys a commit build to `.zone` and `.today`; a published GitHub release (not a prerelease, cut from `main`) rebuilds with the tag as the version and deploys it there too. Any environment can be promoted by hand (Actions → CDN deploy → Run workflow with an environment, a version and a percentage); that is how production (`.org`) goes live, and it only takes a release tag, while `.zone` and `.today` also take a commit build (`1.0.0-<runId>.commit-<sha7>`). The `org` and `zone` GitHub environments only accept runs from protected branches, and `today` accepts `main` plus `*.*.*` tags. Rolling back is not one run: see the comments on the `promote` job. Versions published before this workflow existed (the npm-era builds) cannot be promoted, so a rollback cannot go past it. Source maps upload to Sentry only when `SENTRY_AUTH_TOKEN` is set and are deleted before the CDN upload.

## Documentation: `docs/` (committed) and `design/` (local)

This repo is public, so anything committed is published. Two folders with different jobs:

- **`docs/` is committed and is the team's shared context.** It holds what the code cannot explain and every contributor and agent must respect:
  - `docs/DECISIONS.md`: product and technical decisions per flow — deliberate differences from the legacy Builder, scope cuts, back-end and chain facts the client depends on. **Read the section for the flow you are touching before changing it**; a behavior listed there is a decision, not a bug. When a change makes, reverses or extends a decision, update the entry in the same PR (rewrite in place, don't append contradictions).
  - `docs/TRACKING_SPEC.md`: the analytics contract (event names, props, the `source` convention, what is deliberately not tracked). Code and spec change together.
  - `docs/VALIDATION_PARITY.md`: every legacy client-side item validation and its status here; the acceptance criteria when a validation-bearing feature is migrated.

  Keep `docs/` durable and short: no layout or copy descriptions (the code and Figma are the reference), no local paths, no plans or research, and nothing that isn't safe in a public repo.

- **`design/` is gitignored and local.** It holds working documents: full feature specs written from the Figma mockups before and during implementation, legacy reviews, plans, research notes, audits. They are the source of truth _while a feature is being built_; once it ships the code is the better description, and only the durable residue (decisions, tracking, parity) moves to `docs/`. A spec there may be stale or describe unmerged work; the code and `docs/` win when they disagree. Don't reference `design/` files from committed files (code comments, `docs/`, PR descriptions), since other machines don't have them.

Code/copy rules live in `CONVENTIONS.md`.

The spec for all of Decentraland's public APIs is available at https://docs.decentraland.org/apis — consult it when integrating with or debugging any Decentraland API.

## Conventions

### i18n (hard rule)

Every user-facing string — buttons, labels, headings, placeholders, statuses, errors, tooltips, empty states — goes through `t('a.b.c')` with a key added to **every** locale file: `en.json`, `es.json` and `zh.json`. Never hardcode a display string in a component; this is part of "done" for any UI change. Spanish uses neutral (Latin American) **"tú"** forms, never "vos" ("Inicia sesión", not "Iniciá"). Chinese is Simplified, follows the sites repo's `zh.json` style (您, full-width punctuation, a space between Chinese and Latin text) and keeps its fixed terms: 系列 (collection), 可穿戴物品 (wearable), 表情动作 (emote), 物品 (item), 积分 (credits); brand names (Decentraland, MANA, Marketplace, Shop, Builder, Creator Hub) stay in English.

One exception: item validation findings show the wearable-validator rule book's own English messages and check titles, so the editor says exactly what curation says. Copy the app adds around them (badge states, fallbacks when a check can't run) still goes through `t()`.

### Copy (relaxed web2-first)

Prefer friendly copy and hide blockchain plumbing where possible. Wallet/MANA/transaction terms are allowed where the flow genuinely requires them (publishing, fees) — creators are a crypto-aware audience. Never surface a raw error to the user: report it to Sentry and show human-friendly copy.

### Styling

New and converted components use CSS Modules; Emotion (`*.styles.ts`) remains only in files not yet converted, and no new one is added (`src/styles/migration.spec.ts` lists them). Full rules in "Styling" in `CONVENTIONS.md`.

- Every component is a folder — `components/Foo/{Foo.tsx, Foo.module.css, Foo.spec.tsx, index.ts}` — with `index.ts` re-exporting so consumers import `~/components/Foo`. `import styles from './Foo.module.css'` and `className={styles.root}`; merge a consumer's `className` with `cx` from `~/lib/cx`.
- Values come from the tokens, never re-hardcoded hexes or radii: `var(--color-dcl-red)`, `var(--radius-btn)`, … in modules (`src/styles/tokens.css`, generated from `src/styles/theme.ts` by `npm run tokens`; edit the theme, then regenerate). TypeScript and unconverted `*.styles.ts` files import the theme object directly (`import { theme } from '~/styles/theme'`), never via ThemeProvider or `({ theme }) =>` callbacks.
- Media queries use the canonical breakpoints of `theme.ts` as literals (custom properties can't appear in media conditions): `@media (max-width: 768px)`, and `@media not all and (max-width: 768px)` for the exact complement. A spec fails on any other width unless it is allowlisted there.
- Cascade layers: `@layer reset, foundations` (declared once in `index.html`). Shared components that others restyle (Button, `shared.module.css`, small atoms) put their rules in `@layer foundations`; feature modules stay unlayered, so a consumer's class always beats a foundation's. Rules that style an element another library styles (a MUI icon's `svg`) stay unlayered.
- State and variants are `data-*` attributes (`data-open`, `data-variant`, `data-selected`) styled via `&[data-…]` selectors — never `is-*`/BEM-modifier classNames.
- **Buttons**: every action button/link is `~/components/Button` (`variant` / `size` / `loading`, polymorphic `as`). Layout-only tweaks go through `className` (or `styled(Button)` in an unconverted file); never re-declare a button's colors or variants in a page's styles.
- **Icons**: Material glyphs from `@mui/icons-material`; Figma-specific glyphs as inline-SVG components in `~/components/Icons` — see "Icons" in `CONVENTIONS.md`.
- **Never use a styled component as a selector** inside another styled template (`${Name} { … }`): it compiles in the Vite build but throws in Vitest. Target a stable `[data-testid]` / `[data-*]` hook instead.

### Feature flags

Decentraland's flag service is read through `lib/featureFlags` (one `FeatureFlag` enum entry plus its owning application, `builder` or `dapps`) and consumed with `useFeatureFlag(flag)` → `{ enabled, isLoading }`. Reads fail closed: a flag still loading, absent, or unreachable is off. Add a flag by adding the enum entry and its `APPLICATION` row — never by fetching the service anywhere else. Locally, override with `VITE_FEATURE_FLAG_OVERRIDES=unity-wearable-preview:true`. In specs, mock `~/lib/featureFlags` onto `~/test/featureFlags` and declare the flags the subject runs with via `setFeatureFlags(...)`.

### Testing

Unit tests for the logic layer, e2e for user flows.

- Unit tests are colocated with their subject (`foo.spec.ts` next to `foo.ts`). `lib/` and `store/` are the well-covered logic layer — every module there gets unit tests. Pages get no unit tests; they're covered by e2e.
- **Components with logic get unit tests.** Purely presentational/atomic components don't need them; any component carrying real behavior does.
- **Every user-facing flow has an e2e test** covering its happy path — this is part of "done" for a feature. E2E tests drive the app in a real headless browser with wallet, network, and HTTP fully mocked — never introduce a real network call or real key.
- **E2E harness (`e2e/`).** `launchApp(opts)` opens the app on the dev server with a restored session for a deterministic fake wallet (`signedOut: true` for a visitor) and answers every off-origin request through `helpers/route.ts`, matched by the `dev.json` hostnames. builder-server (`helpers/builderServer.ts`) and marketplace-server (`helpers/market.ts`) are in-memory stores seeded per spec from the `e2e/fixtures.ts` factories: writes mutate them, so assert on what the page shows after a save, not on the requests. One fake chain (`helpers/rpc.ts`) backs both the read node and the wallet: signatures are real (test key), every transaction settles at once and lands in `app.transactions` decoded, and the fake builder-server applies what an indexer would (owner, roles, approval, rescue, a third party's root); a wallet off Polygon goes through the fake relayer, whose calls land there too, flagged `relayed`. The wearable-preview iframe is a fake that speaks its postMessage protocol (`helpers/preview.ts`), and reports sound for an item that ships audio. Flags are off unless a spec passes `flags` (keyed `${application}-${flag}`); `app.waitForEvent(name, props)` and `app.pageViews()` read Segment across reloads; `app.openedUrls` records `window.open`. Model fixtures live in `e2e/fixtures/files` (see `helpers/files.ts` for which pass the rule book) and are served from storage under the fixture hashes; zips are built at run time. A route the app needs and the harness lacks is logged as `[e2e] unmocked …`: add it to the router or a fake, never let it reach the network. The run fails if its port is already taken, so a server from another worktree is never tested by mistake.
- **Test functionality, not implementation (hard rule).** Write tests from the user's / use-case perspective: given this input or action, this observable outcome. Never assert on internals (call order, private state shape, intermediate steps) that a refactor could change without changing behavior. After a refactor, don't add or keep tests pinned to the old implementation's specifics — if a test breaks while behavior didn't, rewrite or delete it rather than patching it to match the new internals. Fewer meaningful use-case tests beat many noisy atomic ones.
- **Select by `data-testid`, never by CSS class (hard rule).** Add a stable `data-testid` and select on `[data-testid="…"]`; for stateful/variant elements assert on `data-*` attributes. Styling class names are presentational and change with the design.

### Analytics and error reporting (part of every feature plan)

Every feature plan and spec includes an analytics section before implementation starts: the funnel of the feature's usage (entry → key steps → outcome) or the product metrics that match its business impact, as Segment events through `lib/analytics#track`, with names and props recorded in `docs/TRACKING_SPEC.md` in the same change. Where a step can fail in a way the team must know about (a request the user can't recover from, a data or schema mismatch, an unexpected throw), report it to Sentry through `lib/monitoring#captureError` with a `flow` tag; expected states the user can fix themselves (offline, permission denied, validation warnings) are tracked as events, not errors. A feature without its events and error reporting is not "done".

### Responsive (standing requirement)

Every feature or edit must work on mobile as well as desktop — responsive behavior is part of "done" for any UI change. Verify at a narrow viewport (≤ 768px, the primary mobile breakpoint) as well as desktop; keep touch targets ~44px; hover-only affordances need a tap/focus equivalent; anchored overlays must not spill off-screen on narrow widths.

### Performance and SEO (standing requirement)

The overview at `/` is the public, indexed landing page (`decentraland.org/create`) and must stay fast on mobile. Lighthouse targets: mobile and desktop performance ≥ 0.85, CLS < 0.1, SEO ≥ 0.92 on `.org`. Any change that touches the overview, the shell (navbar, footer, `App.tsx`, `main.tsx`) or `index.html` keeps them:

- **Keep the first load lean.** Code reachable from `main.tsx` without a `React.lazy` boundary ships to every visitor of the landing page. Don't add editor, publishing, chain or zip code (viem, `@dcl/crypto`, `lib/chain`, `jszip`, `@dcl/schemas`' root barrel, …) to that graph; put it behind a lazy route or a dynamic `import()`. The navbar and the session restore reach the chain only through `~/lib/auth`, whose reads, writes and signing load on first use, and `src/main.firstLoad.spec.ts` fails once any of it becomes statically reachable. `ajv` still arrives through the `@dcl/schemas` enums the navbar and the auth module import; dropping it is the open follow-up.
- **Defer what isn't the first paint.** Third-party widgets, embeds, extra monitoring and decorative media load through `lib/idle` (`afterLoadIdle` / `useAfterLoadIdle`) or on approach (`useInView`), never at startup.
- **Images:** Contentful images go through `lib/contentfulImage` (resized WebP); every `<img>` whose box depends on the image gets `width`/`height`; below-the-fold images are `loading="lazy"`. The LCP image is preloaded in `index.html` for its route only, kept in sync with the code by a spec.
- **No layout shift:** reserve space for anything that appears late (images, async rails, gated UI), and keep `"Inter Fallback"` in the font stack.
- **SEO:** keep the static title, description, canonical, Open Graph/Twitter tags and JSON-LD in `index.html`; `lib/seo` points canonical/`og:url` at the production URL per route. Link text is descriptive (never a bare "See more"), images that convey content get `alt`, and structured data that mirrors copy is built from `t()`.
- **Measure, don't guess.** For a change that can affect load, compare Lighthouse (mobile and desktop) of `main` vs the branch, both served locally with `npm run build` + `npx vite preview`. Don't judge from `.zone` (served with `noindex`, which caps SEO) or from Vercel previews (behind Vercel auth, so Lighthouse scores the login page).
