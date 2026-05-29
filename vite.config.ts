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
    // Hidden source maps: emit .map files for Sentry upload but omit the
    // //# sourceMappingURL comment from served JS to reduce CDN/browser overhead.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — always needed
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Only Radix primitives mounted at app root (Toaster, TooltipProvider).
          // Other primitives (dialog, tabs, accordion, dropdown-menu, select) are
          // only used inside route-level components and code-split naturally
          // via React.lazy boundaries in App.tsx.
          ui: [
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
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
