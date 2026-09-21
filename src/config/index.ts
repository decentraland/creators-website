import { Env, createConfig } from '@dcl/ui-env'
import dev from './env/dev.json'
import prod from './env/prd.json'
import stg from './env/stg.json'

// Router basename: the pathname of Vite's base, which is VITE_BASE_URL (a CDN URL) in CI builds and '/' locally
export const basePath = import.meta.env.BASE_URL.startsWith('http')
  ? new URL(import.meta.env.BASE_URL).pathname
  : import.meta.env.BASE_URL

export const config = createConfig(
  {
    [Env.DEVELOPMENT as string]: dev,
    [Env.STAGING as string]: stg,
    [Env.PRODUCTION as string]: prod
  },
  {
    systemEnvVariables: {
      VITE_DCL_DEFAULT_ENV: import.meta.env.VITE_DCL_DEFAULT_ENV ?? 'dev'
    }
  }
)

// The one place query params are read (see CONVENTIONS.md "Runtime config").
const search = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

/** `?unity=false` forces the Babylon preview renderer, a debugging escape hatch; any other value is ignored. */
export const previewRendererOverride: 'babylon' | null = search.get('unity') === 'false' ? 'babylon' : null

/** The deployed version, written into `.env` from package.json by `scripts/prebuild.cjs`. */
export const APP_VERSION = import.meta.env.VITE_REACT_APP_WEBSITE_VERSION ?? 'unknown'
