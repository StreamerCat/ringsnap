module.exports = {
  ci: {
    collect: {
      // Start vite preview server against the built dist/ directory.
      // Run `npm run build:no-prerender` before `npm run test:lhci`.
      startServerCommand: 'npx vite preview --port 4173',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/pricing',
        'http://localhost:4173/plumbers',
        'http://localhost:4173/difference',
      ],
      numberOfRuns: 2,
      settings: {
        // Skip PWA audits — RingSnap is not a PWA
        skipAudits: [
          'installable-manifest',
          'splash-screen',
          'themed-address-bar',
          'pwa-cross-browser',
          'pwa-page-transitions',
          'pwa-each-page-has-url',
          'service-worker',
          // Skip favicon audit — handled by site.webmanifest
          'maskable-icon',
        ],
      },
    },
    assert: {
      assertions: {
        // --- Category score gates ---
        // Performance is noisy under CI CPU throttling; use warn at 0.6 to catch
        // severe regressions without false positives. Hard-gate specific audits instead.
        'categories:performance': ['warn', { minScore: 0.6 }],
        // Accessibility, Best Practices, SEO are stable — hard gate at 0.85.
        'categories:accessibility': ['error', { minScore: 0.85 }],
        'categories:best-practices': ['error', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.85 }],

        // --- SEO audits (deterministic — gate as errors) ---
        'document-title': ['error', {}],
        'meta-description': ['error', {}],
        'image-alt': ['error', {}],
        'html-has-lang': ['error', {}],
        'viewport': ['error', {}],
        'link-text': ['warn', {}],
        'structured-data': ['warn', {}],

        // --- Performance audits (warn — noisy in localhost CI) ---
        'render-blocking-resources': ['warn', {}],
        'uses-text-compression': ['warn', {}],
        'uses-optimized-images': ['warn', {}],
        'offscreen-images': ['warn', {}],
        'unused-javascript': ['warn', {}],
        'unused-css-rules': ['warn', {}],

        // --- Disabled audits: not meaningful on localhost CI ---
        'robots-txt': 'off',        // Only valid on real domain
        'canonical': 'off',         // localhost returns no canonical
        'is-crawlable': 'off',      // localhost returns no robots.txt
        'hreflang': 'off',          // Not used on this site
        'tap-targets': 'off',       // Too noisy / layout-dependent
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
