# Conventions

Code rules for wemotes-builder. General project guidance lives in `CLAUDE.md`; this file holds the hard rules that every PR must respect.

## Component organization (semantic, hard rules)

There is no separate `pages/` folder — page components live in `src/components/` (e.g. `components/OverviewPage`), one per route, declared in `src/App.tsx` and lazy-loaded.

- A component used by a single page lives **inside that page's folder** (as its own folder or a single file), e.g. `components/OverviewPage/OverviewHeader` — never at the root of `components/`.
- When a page-local component becomes needed by another page or component, **move it up** to the root of `components/`.
- The root of `components/` holds only: page components, components used by more than one page, and components reused by multiple other root components. Nothing else.

## Architecture: host-portability seams (hard rules)

The app is a standalone web app today. In the future it may also be embedded inside the creator-hub Electron app — rendered in an iframe and talking to the host over a two-way postMessage/`@dcl/mini-rpc` channel, the same pattern creator-hub uses for `@dcl/inspector`. We build **none** of that now (no RPC layer, no host adapter, no electron-mode flag). Instead, these four seams stay clean so a future embed is a bounded integration instead of a rewrite:

### 1. Auth is a sealed module

Only `src/lib/auth/` (and the wallet zustand store it feeds) may import `decentraland-connect`, `@dcl/single-sign-on-client`, or `@dcl/crypto`, or hold an EIP-1193 provider. The rest of the app consumes:

- the wallet store (address, connection state), and
- `~/lib/auth` helpers: `getIdentity()` (AuthChain identity) and `signedFetch()`.

Every builder-server client in `lib/` signs requests through that single chokepoint — never ad-hoc signing in components or hooks. The interface stays **async and provider-shaped**: where the identity comes from (local login vs. handed over by a host) and where on-chain calls are signed (local provider vs. proxied `request({ method, params })`) must be swappable behind it without touching consumers.

### 2. Host-facing side effects go through `lib/` modules

- External links: never raw `window.open` or plain `<a target="_blank">` to external sites — use the `~/lib` navigation helper (an Electron host must route these through `shell.openExternal`).
- Toasts/notifications: one notifications module; components never render ad-hoc toast systems.
- File acquisition (model/thumbnail pickers, drag-and-drop ingestion): funneled through one `lib/` module, not `<input type="file">` handling scattered across components.

Standalone implementations are trivial; the rule exists so each can later become "forward to host over RPC".

### 3. Runtime config is resolved in exactly one place

Only `src/config/` may read `window.location.search`, query params, or `window.parent`. Everything else imports resolved values from `~/config`. A future embed handshake (`?parent=<origin>`, analytics id, etc.) lands there and nowhere else; "embedded" is derived structurally from config, never from scattered environment sniffing.

### 4. The router is created at one call site

One file creates the router, with `basename` taken from config. No other module constructs routers or assumes how the app is served (path, host, hash), so serving from a different origin/path under a host is a one-file change.
