import { Env } from '@dcl/ui-env'
import { createEnvConfig, resolveBasePath, resolveEnv } from './env'
import dev from './env/dev.json'
import prod from './env/prd.json'
import stg from './env/stg.json'

// Router basename. The app is served by path at decentraland.<tld>/create (assets still come from the
// CDN via Vite's `base`), and from the root on local dev and Vercel previews; the mount point is derived
// from the page URL so one build works in both.
export const basePath = resolveBasePath(typeof window === 'undefined' ? '/' : window.location.pathname)

const systemEnvVariables = { VITE_DCL_DEFAULT_ENV: import.meta.env.VITE_DCL_DEFAULT_ENV ?? 'dev' }

export const config = createEnvConfig(
  {
    [Env.DEVELOPMENT]: dev,
    [Env.STAGING]: stg,
    [Env.PRODUCTION]: prod
  },
  resolveEnv(typeof window === 'undefined' ? undefined : window.location, systemEnvVariables)
)

// The one place query params are read (see CONVENTIONS.md "Runtime config").
const search = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

/** `?unity=false` forces the Babylon preview renderer, a debugging escape hatch; any other value is ignored. */
export const previewRendererOverride: 'babylon' | null = search.get('unity') === 'false' ? 'babylon' : null

/** The deployed version, written into `.env` from package.json by `scripts/prebuild.cjs`. */
export const APP_VERSION = import.meta.env.VITE_REACT_APP_WEBSITE_VERSION ?? 'unknown'
