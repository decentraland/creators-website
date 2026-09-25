import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, loadEnv, type PluginOption } from 'vite'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as {
  version: string
}

// Source maps are emitted and uploaded only when the deploy workflow passes a token. Local builds and
// the CI build check keep producing no maps at all, so nothing extra can ever reach the CDN.
const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN)

/**
 * The ONE release identifier: the maps are uploaded under it and the runtime reports it (via the
 * `__SENTRY_RELEASE__` define). Sentry applies a map only when the two strings are identical, so
 * deriving both from here is what keeps them from drifting apart and leaving every stack minified.
 */
const sentryRelease = `creators-website@${pkg.version}`

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    define: { __SENTRY_RELEASE__: JSON.stringify(sentryRelease) },
    plugins: [
      react(),
      ...(sentryUpload
        ? [
            // The plugin is declared `=> any`; pin it to vite's own plugin type so the spread stays typed.
            sentryVitePlugin({
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
              authToken: process.env.SENTRY_AUTH_TOKEN,
              release: { name: sentryRelease },
              // The build machine doesn't need to phone home about itself.
              telemetry: false,
              // Upload, then delete: a .map served from the CDN would publish the whole source.
              sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] }
            }) as PluginOption
          ]
        : [])
    ],
    resolve: {
      alias: [
        { find: '~', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        // Its `browser` field is a UMD bundle whose default export Vite can't interop; use the ESM build.
        // Exact match only: the package's CSS import must keep resolving from the package root.
        { find: /^react-datepicker$/, replacement: 'react-datepicker/dist/es/index.js' }
      ],
      // decentraland-ui2 nests its own @emotion/styled; two emotion copies means two ThemeContexts,
      // so MUI's theme provider never reaches ui2's styled components.
      dedupe: ['@emotion/react', '@emotion/styled']
    },
    ...(command === 'build' ? { base: envVariables.VITE_BASE_URL } : undefined),
    // 'hidden': the maps are written for the upload but no `sourceMappingURL` comment is emitted, so
    // the shipped bundles don't point the CDN at files that were deleted right after they went up.
    build: { sourcemap: sentryUpload ? 'hidden' : false },
    server: {
      // Proxy the auth app so sign-in stays same-origin on localhost (shared identity storage).
      // Vercel previews get the same via the rewrite in vercel.json — keep the two in step. Real
      // deploys (decentraland.<tld>) need neither: /auth is genuinely same-origin there.
      // Regexp key on purpose: a plain '/auth' prefix would also proxy /authorizations.
      proxy: {
        '^/auth(/|$)': {
          target: 'https://decentraland.zone',
          changeOrigin: true,
          secure: false,
          followRedirects: true,
          ws: true
        }
      }
    }
  }
})
