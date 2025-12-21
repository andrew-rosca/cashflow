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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
