# Conventions

Code rules for creators-website. General project guidance lives in `CLAUDE.md`; this file holds the hard rules that every PR must respect.

## Component organization (semantic, hard rules)

There is no separate `pages/` folder — page components live in `src/components/` (e.g. `components/CollectionsPage`), one per route, declared in `src/App.tsx` and lazy-loaded.

- A component used by a single page lives **inside that page's folder** (as its own folder or a single file), e.g. `components/CollectionsPage/CollectionCard` — never at the root of `components/`.
- When a page-local component becomes needed by another page or component, **move it up** to the root of `components/`.
- The root of `components/` holds only: page components, components used by more than one page, and components reused by multiple other root components. Nothing else.

## Architecture: host-portability seams (hard rules)

The app is a standalone web app today. In the future it may also be embedded inside the creator-hub Electron app — rendered in an iframe and talking to the host over a two-way postMessage/`@dcl/mini-rpc` channel, the same pattern creator-hub uses for `@dcl/inspector`. We build **none** of that now (no RPC layer, no host adapter, no electron-mode flag). Instead, these seams stay clean so a future embed is a bounded integration instead of a rewrite:

### 1. Auth is a sealed module

Only `src/lib/auth/` (and the wallet zustand store it feeds) may import `decentraland-connect`, `@dcl/single-sign-on-client`, or `@dcl/crypto`, or hold an EIP-1193 provider. The rest of the app consumes:

- the wallet store (address, connection state), and
- `~/lib/auth` helpers: `signedFetch()` and `signWithIdentity()` (AuthChain, both async), and the chain calls (`readContract`, `sendContractTransaction`, `signTypedData`, …), which load viem on first use.

Every builder-server client in `lib/` signs requests through that single chokepoint — never ad-hoc signing in components or hooks. The interface stays **async and provider-shaped**: the session carries the wallet's EIP-1193 `provider` and viem clients are built over it only inside `lib/auth`'s lazily loaded modules, so where the identity comes from (local login vs. handed over by a host) and where on-chain calls are signed (local provider vs. proxied `request({ method, params })`) stay swappable without touching consumers. `lib/chain` is protocol code (contract registry, meta-transaction encoding) and never sees the provider: `lib/auth` hands it the wallet requests it needs.

### 2. Host-facing side effects go through `lib/` modules

- External links: never raw `window.open` or plain `<a target="_blank">` to external sites — use the `~/lib` navigation helper (an Electron host must route these through `shell.openExternal`).
- Toasts/notifications: one notifications module; components never render ad-hoc toast systems.
- File acquisition (model/thumbnail pickers, drag-and-drop ingestion): funneled through one `lib/` module, not `<input type="file">` handling scattered across components.

Standalone implementations are trivial; the rule exists so each can later become "forward to host over RPC".

### 3. Runtime config is resolved in exactly one place

Only `src/config/` may read `window.location.search`, query params, or `window.parent`. Everything else imports resolved values from `~/config`. A future embed handshake (`?parent=<origin>`, analytics id, etc.) lands there and nowhere else; "embedded" is derived structurally from config, never from scattered environment sniffing.

### 4. The router is created at one call site

One file creates the router, with `basename` taken from config. No other module constructs routers or assumes how the app is served (path, host, hash), so serving from a different origin/path under a host is a one-file change.

### 5. Back-end clients are folders with one transport

Each back end the app calls has its client under `src/lib/<server>/`: a `transport.ts` that owns the base URL, request signing and envelope parsing, endpoint modules beside it, and an `index.ts` that re-exports them. Only the client's own folder imports its transport, so moving to a server with another base path or routes touches that folder alone. Components get data through hooks: from `~/lib/builder` they import URL helpers, error classification and any type, never endpoint functions. ESLint enforces it for the static `~/` imports the codebase uses. Today only builder-server (`src/lib/builder/`) follows it; marketplace-server (`lib/coupons`, `lib/trades`, `lib/listings`) and credits-server (`lib/credits`, `lib/creditPacks`) are the follow-ups.

## Icons

Two sources, nothing else — no icon fonts, no SVG loader/svgr, no per-icon `<img>`:

- **Generic glyphs** (add, edit, chevrons, more, close, search…) come from `@mui/icons-material`, which decentraland-ui2 already ships: `import { Add as AddIcon } from '@mui/icons-material'`. Prefer these whenever the design uses a stock Material glyph.
- **Figma-specific glyphs** (brand/product icons that have no Material equivalent, e.g. Jump In, Open Editor) live in `src/components/Icons/`, one file per icon (`JumpInIcon.tsx`), re-exported from `index.ts`. Each is a plain React component rendering an inline `<svg>` with `fill="currentColor"`, `aria-hidden`, `focusable="false"`, the design's intrinsic `width`/`height`, and `...props: SVGProps<SVGSVGElement>` spread last so callers can override. Paste the Figma path data as-is; drop wrappers (`<g clip-path>`, `<defs>`) and hard-coded fills so the glyph inherits the button/text color. Never import `@mui/material` to build icons — it is only a transitive dependency here.

Icons are decorative: the accessible name comes from the button/link text or its `aria-label`, never from the SVG.

## Memoization (hard rule)

Any O(n) derivation computed in a component's render body — `find`, `some`, `every`, `filter`, `map`, `sort`, `reduce`, `Object.keys/values/entries` over data, or a helper that does one of those — goes in `useMemo` with exact deps, regardless of how small the array is today. Values, not size, decide: a memo is also required whenever the result feeds a dependency array, a react-query key, or a heavy child such as `WearablePreview`, since a fresh identity there costs a rerun or a reload.

- A JSX `.map` that only renders children is exempt; wrap it once its result is reused.
- Hooks sit above any early `return`; move the derivation up rather than skipping the memo.
- Callbacks passed to memoized or heavy children go through `useCallback`, otherwise the memo on the child is dead.
- `t` from `useTranslation` is referentially stable and safe in deps. Keep it that way: any hook returned from `~/intl` or a store must return stable functions.
