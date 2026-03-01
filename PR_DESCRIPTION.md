# Fix Google Indexing Issues (404s)

## Overview

This PR resolves an issue where Google bots and users were encountering 404 errors on marketing pages (e.g., `/pricing`, `/difference`) because the server was configured to look for non-existent static HTML files.

## Changes

### DevOps / Configuration

- **`public/_redirects`**: Removed explicit rewrite rules that pointed to `dist/PAGE/index.html`.
  - **Before**: Forced Netlify to serve a specific static file. If the file was missing (e.g., due to skipped prerendering in CI), it returned a 404.
  - **After**: Relies on Netlify's default behavior. It will serve the static file *if it exists*; otherwise, it automatically falls back to the SPA (`/index.html`), ensuring the page always loads correctly.

## Verification

- Verified that the explicit rewrite rules causing the 404s are removed.
- Use `npm run build` locally to confirm the build process is unaffected.
- **Post-Deploy Test**: Visit `/pricing` and `/difference` to ensure they load with a 200 OK status.
