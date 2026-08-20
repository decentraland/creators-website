import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
// eslint-disable-next-line import/no-default-export
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    ...(command === 'build' ? { base: envVariables.VITE_BASE_URL } : undefined)
  }
})
