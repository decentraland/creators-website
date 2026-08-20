import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url))
      }
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
