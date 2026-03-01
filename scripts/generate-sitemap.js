
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://getringsnap.com';

// Marketing pages that should be indexed
// Keep this in sync with vite.config.ts MARKETING_ROUTES
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
    // Resource Center
    { path: '/resources', changefreq: 'weekly', priority: '0.9' },
    { path: '/resources/hvac-dispatcher-script-template', changefreq: 'monthly', priority: '0.8' },
    { path: '/resources/plumbing-dispatcher-script-template', changefreq: 'monthly', priority: '0.8' },
    { path: '/resources/electrician-call-answering-script', changefreq: 'monthly', priority: '0.8' },
    { path: '/resources/hvac-after-hours-answering-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/hvac-price-shopper-phone-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/hvac-emergency-call-triage', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/burst-pipe-call-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/sewer-backup-call-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/drain-cleaning-upsell-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/electrical-safety-triage-questions', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/panel-upgrade-booking-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/power-outage-call-script', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/missed-call-revenue-calculator', changefreq: 'monthly', priority: '0.8' },
    { path: '/resources/after-hours-call-calculator', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/service-pricing-calculator', changefreq: 'monthly', priority: '0.7' },
    { path: '/resources/increase-average-ticket', changefreq: 'monthly', priority: '0.7' },
];

const generateSitemap = () => {
    const currentDate = new Date().toISOString().split('T')[0];

    // Generate XML with proper formatting
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

    // Write to both public (for dev) and dist (for production)
    const publicDir = path.resolve(__dirname, '../public');
    const distDir = path.resolve(__dirname, '../dist');

    const publicSitemapPath = path.join(publicDir, 'sitemap.xml');
    fs.writeFileSync(publicSitemapPath, xml);
    console.log(`✅ Sitemap generated at ${publicSitemapPath}`);

    // Also write to dist if it exists (post-build)
    if (fs.existsSync(distDir)) {
        const distSitemapPath = path.join(distDir, 'sitemap.xml');
        fs.writeFileSync(distSitemapPath, xml);
        console.log(`✅ Sitemap also copied to ${distSitemapPath}`);
    }

    console.log(`📍 Sitemap includes ${routes.length} URLs`);
};

generateSitemap();
