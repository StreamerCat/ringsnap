import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps for production to allow Sentry to show readable stack traces
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — always needed
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Radix UI primitives — shared across most pages
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-select',
          ],
          // Charting — only loaded by dashboard/analytics pages
          charts: ['recharts'],
          // Stripe — only loaded by billing/upgrade pages
          stripe: ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          // Analytics/observability — defer parse until after page loads
          analytics: ['posthog-js', '@sentry/react'],
          // Vapi voice SDK — only loaded on specific pages
          vapi: ['@vapi-ai/web'],
        },
        // Include source maps in separate files (not inline) for Sentry upload
        sourcemapExcludeSources: false,
      },
    },
  },
}));
