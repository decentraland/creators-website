import { Env } from '@dcl/ui-env'
import { createEnvConfig, resolveEnv } from './env'
import dev from './env/dev.json'
import prod from './env/prd.json'
import stg from './env/stg.json'

// Router basename: the pathname of Vite's base, which is VITE_BASE_URL (a CDN URL) in CI builds and '/' locally
export const basePath = import.meta.env.BASE_URL.startsWith('http')
  ? new URL(import.meta.env.BASE_URL).pathname
  : import.meta.env.BASE_URL

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
