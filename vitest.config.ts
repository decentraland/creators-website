import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Separate from vite.config.ts: vitest bundles its own vite, so keeping plugin/type graphs apart
// avoids dual-vite type conflicts. The react plugin is cast to bypass that nested-vite typing.
export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react() as any],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    // Vitest loads the developer's .env; a local VITE_DCL_DEFAULT_ENV override would flip
    // ~/config away from the dev values the specs assert on.
    env: { VITE_DCL_DEFAULT_ENV: 'dev' },
    // @dcl/ui-env ships extensionless internal imports (dist/index.js → './config') that Vitest's
    // resolver can't follow; inlining it routes the dep through Vite's resolver, which can.
    server: { deps: { inline: ['@dcl/ui-env'] } },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**'],
      exclude: ['src/**/*.spec.*', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts', 'src/**/*.d.ts']
    }
  }
})
