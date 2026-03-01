import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL, getSortedIndexableRoutes } from './seo-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateSitemap = () => {
  const currentDate = new Date().toISOString().split('T')[0];
  const routes = getSortedIndexableRoutes();

  const urlEntries = routes.map((route) => {
    const loc = `${BASE_URL}${route.path}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;

  const publicDir = path.resolve(__dirname, '../public');
  const distDir = path.resolve(__dirname, '../dist');

  const publicSitemapPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(publicSitemapPath, xml);
  console.log(`✅ Sitemap generated at ${publicSitemapPath}`);

  if (fs.existsSync(distDir)) {
    const distSitemapPath = path.join(distDir, 'sitemap.xml');
    fs.writeFileSync(distSitemapPath, xml);
    console.log(`✅ Sitemap also copied to ${distSitemapPath}`);
  }

  console.log(`📍 Sitemap includes ${routes.length} URLs`);
};

generateSitemap();
