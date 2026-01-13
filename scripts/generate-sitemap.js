
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://getringsnap.com';

const routes = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/pricing', changefreq: 'monthly', priority: '0.9' },
    { path: '/difference', changefreq: 'monthly', priority: '0.8' },
    { path: '/plumbers', changefreq: 'monthly', priority: '0.8' },
    { path: '/hvac', changefreq: 'monthly', priority: '0.8' },
    { path: '/electricians', changefreq: 'monthly', priority: '0.8' },
    { path: '/roofing', changefreq: 'monthly', priority: '0.8' },
    { path: '/privacy', changefreq: 'yearly', priority: '0.5' },
    { path: '/terms', changefreq: 'yearly', priority: '0.5' },
];

const generateSitemap = () => {
    const currentDate = new Date().toISOString().split('T')[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
            .map(
                (route) => `  <url>
    <loc>${BASE_URL}${route.path}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
    <lastmod>${currentDate}</lastmod>
  </url>`
            )
            .join('\n')}
</urlset>`;

    const publicDir = path.resolve(__dirname, '../public');
    const sitemapPath = path.join(publicDir, 'sitemap.xml');

    fs.writeFileSync(sitemapPath, xml);
    console.log(`✅ Sitemap generated at ${sitemapPath}`);
};

generateSitemap();
