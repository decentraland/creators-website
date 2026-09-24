import { Env, getEnv } from '@dcl/ui-env'

type SystemEnvVariables = NonNullable<Parameters<typeof getEnv>[0]>

// The production domain and its subdomains; narrower than @dcl/ui-env's "any .org / .co" rule.
const PRODUCTION_DOMAIN = 'decentraland.org'

export function isProductionHost(host: string): boolean {
  const hostname = host.split(':')[0].toLowerCase()
  return hostname === PRODUCTION_DOMAIN || hostname.endsWith(`.${PRODUCTION_DOMAIN}`)
}

/**
 * The environment for this page load. `?env=` may switch a local, .zone or .today visitor to another
 * back end; a production visitor is never switched, so a link cannot make decentraland.org sign
 * requests against dev or staging services.
 */
export function resolveEnv(location: Pick<Location, 'host'> | undefined, systemEnvVariables: SystemEnvVariables): Env {
  if (location && isProductionHost(location.host)) return Env.PRODUCTION
  return getEnv(systemEnvVariables)
}

/** The path the app is mounted on: decentraland.<tld>/create serves it by path, everything else at the root. */
export const CREATE_PATH = '/create'

/**
 * Router basename for the current page. One build serves both the by-path deploy (`/create/...`) and
 * the root-served previews (Vercel, `vite dev`), so the mount point is read from the URL, not baked in.
 */
export function resolveBasePath(pathname: string): string {
  return pathname === CREATE_PATH || pathname.startsWith(`${CREATE_PATH}/`) ? CREATE_PATH : '/'
}

export type EnvConfig = {
  get: (name: string, defaultValue?: string) => string
  is: (env: Env) => boolean
  getEnv: () => Env
}

/** `@dcl/ui-env`'s config surface over a pre-resolved environment. */
export function createEnvConfig(configByEnv: Partial<Record<Env, Record<string, string>>>, env: Env): EnvConfig {
  const values = configByEnv[env]
  return {
    get: (name, defaultValue = '') => {
      if (!values) throw new Error(`Could not find a config for env=${env}`)
      return name in values ? values[name] : defaultValue
    },
    is: candidate => env === candidate,
    getEnv: () => env
  }
}
