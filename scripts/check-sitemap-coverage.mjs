import fs from 'fs';
import { BASE_URL, FIELD_GUIDE_ROUTE_PATHS, getSortedIndexableRoutes } from './seo-routes.js';

const sitemapPath = 'public/sitemap.xml';
const sitemap = fs.readFileSync(sitemapPath, 'utf8');

const locMatches = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const locSet = new Set(locMatches);

const expectedRoutes = getSortedIndexableRoutes().map((route) => `${BASE_URL}${route.path}`);
const missingExpected = expectedRoutes.filter((url) => !locSet.has(url));

const expectedFieldGuideUrls = FIELD_GUIDE_ROUTE_PATHS.map((path) => `${BASE_URL}${path}`);
const missingFieldGuides = expectedFieldGuideUrls.filter((url) => !locSet.has(url));

if (missingExpected.length || missingFieldGuides.length) {
  console.error('❌ sitemap coverage check failed');
  if (missingExpected.length) {
    console.error('Missing expected indexable URLs:');
    missingExpected.forEach((url) => console.error(` - ${url}`));
  }
  if (missingFieldGuides.length) {
    console.error('Missing field-guide/resource URLs:');
    missingFieldGuides.forEach((url) => console.error(` - ${url}`));
  }
  process.exit(1);
}

console.log(`✅ sitemap coverage check passed (${locSet.size} URLs)`);
