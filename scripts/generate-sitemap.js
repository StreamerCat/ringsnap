import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL, getSortedIndexableRoutes } from './seo-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Route classification ───────────────────────────────────────────────────

function classifyRoute(routePath) {
  if (routePath.startsWith('/resources')) return 'resources';
  if (routePath.startsWith('/compare')) return 'compare';
  return 'core';
}

// ─── XML builders ───────────────────────────────────────────────────────────

function buildUrlset(routes, currentDate) {
  const urlEntries = routes.map((route) => {
    const loc = `${BASE_URL}${route.path}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
}

function buildSitemapIndex(sitemapNames, currentDate) {
  const entries = sitemapNames.map((name) => `  <sitemap>
    <loc>${BASE_URL}/${name}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

// ─── Write helper ───────────────────────────────────────────────────────────

function writeToDir(dir, filename, content) {
  if (!fs.existsSync(dir)) return;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Written: ${filePath}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const generateSitemaps = () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const routes = getSortedIndexableRoutes();

  const coreRoutes = routes.filter((r) => classifyRoute(r.path) === 'core');
  const resourceRoutes = routes.filter((r) => classifyRoute(r.path) === 'resources');
  const compareRoutes = routes.filter((r) => classifyRoute(r.path) === 'compare');

  const sitemapFiles = {
    'sitemap-core.xml': buildUrlset(coreRoutes, currentDate),
    'sitemap-resources.xml': buildUrlset(resourceRoutes, currentDate),
    'sitemap-compare.xml': buildUrlset(compareRoutes, currentDate),
  };

  const indexXml = buildSitemapIndex(Object.keys(sitemapFiles), currentDate);

  const publicDir = path.resolve(__dirname, '../public');
  const distDir = path.resolve(__dirname, '../dist');

  // Write sitemap index + segments to public/
  writeToDir(publicDir, 'sitemap-index.xml', indexXml);
  for (const [filename, content] of Object.entries(sitemapFiles)) {
    writeToDir(publicDir, filename, content);
  }

  // Also write a combined sitemap.xml for backwards compatibility
  const combinedXml = buildUrlset(routes, currentDate);
  writeToDir(publicDir, 'sitemap.xml', combinedXml);

  // Mirror to dist/ if it exists
  writeToDir(distDir, 'sitemap-index.xml', indexXml);
  for (const [filename, content] of Object.entries(sitemapFiles)) {
    writeToDir(distDir, filename, content);
  }
  writeToDir(distDir, 'sitemap.xml', combinedXml);

  console.log(`\n📍 Sitemap index: ${Object.keys(sitemapFiles).length} segments`);
  console.log(`   Core URLs:      ${coreRoutes.length}`);
  console.log(`   Resource URLs:  ${resourceRoutes.length}`);
  console.log(`   Compare URLs:   ${compareRoutes.length}`);
  console.log(`   Total URLs:     ${routes.length}`);
};

generateSitemaps();
