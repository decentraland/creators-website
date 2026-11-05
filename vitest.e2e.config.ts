import { defineConfig } from 'vitest/config'

// Browser e2e: Puppeteer drives a Vite dev server from node, so this runs apart from the jsdom unit config.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    globalSetup: ['./e2e/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    // Each spec drives a whole Chrome; parallel files on one machine only add contention. CI shards instead.
    fileParallelism: false
  }
})
