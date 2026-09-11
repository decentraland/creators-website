import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    plugins: [react()],
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
