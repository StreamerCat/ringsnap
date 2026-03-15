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
    // Use hidden source maps: uploaded to Sentry but not served to end users
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Function-based manualChunks for fine-grained splitting of the main bundle
        manualChunks(id) {
          // Sentry — split out so it doesn't inflate the critical-path bundle
          if (id.includes('@sentry/')) {
            return 'sentry';
          }
          // Supabase client
          if (id.includes('@supabase/')) {
            return 'supabase';
          }
          // PostHog analytics
          if (id.includes('posthog-js')) {
            return 'analytics';
          }
          // Stripe
          if (id.includes('@stripe/') || id.includes('stripe-js')) {
            return 'payment';
          }
          // TanStack React Query
          if (id.includes('@tanstack/')) {
            return 'query';
          }
          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          // Radix UI primitives
          if (id.includes('@radix-ui/')) {
            return 'ui';
          }
          // React core
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) {
            return 'vendor';
          }
        },
        // Include source maps in separate files (not inline) for Sentry upload
        sourcemapExcludeSources: false,
      },
    },
  },
}));
