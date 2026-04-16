/// <reference types="vitest" />
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/components/onboarding/__tests__/setup.ts',
    // Exclude Playwright e2e tests, Deno edge function tests, and integration
    // tests that require a live Supabase instance. These must be run via their
    // own dedicated runners (npm run test:e2e, supabase deno test, etc.).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/e2e/go-live/**',
      'tests/signup-critical/**',
      'tests/invite_member.test.ts',
      'supabase/functions/_tests/**',
      'supabase/functions/_shared/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
