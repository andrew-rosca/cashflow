import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Support both node (for API tests) and jsdom (for UI tests)
    // Default to node for existing tests, use jsdom for component tests
    environment: 'node',
    // Exclude Playwright e2e tests from Vitest
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/tests/e2e/**', // Exclude Playwright e2e tests
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
