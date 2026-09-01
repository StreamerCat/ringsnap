import fs from 'fs';
import { BASE_URL, FIELD_GUIDE_ROUTE_PATHS, getSortedIndexableRoutes } from './seo-routes.js';

const SEGMENT_FILES = ['sitemap-core.xml', 'sitemap-resources.xml', 'sitemap-compare.xml'];

const readLocs = (file) => {
  const xml = fs.readFileSync(`public/${file}`, 'utf8');
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
};

const errors = [];

const indexLocs = readLocs('sitemap-index.xml');
const missingSegments = SEGMENT_FILES.filter((file) => !indexLocs.includes(`${BASE_URL}/${file}`));
if (missingSegments.length) {
  errors.push(`sitemap-index.xml does not reference: ${missingSegments.join(', ')}`);
}

const locSet = new Set(SEGMENT_FILES.flatMap(readLocs));

const expectedRoutes = getSortedIndexableRoutes().map((route) => `${BASE_URL}${route.path}`);
const missingExpected = expectedRoutes.filter((url) => !locSet.has(url));
if (missingExpected.length) {
  errors.push(`Missing expected indexable URLs:\n${missingExpected.map((url) => ` - ${url}`).join('\n')}`);
}

const unexpected = [...locSet].filter((url) => !expectedRoutes.includes(url));
if (unexpected.length) {
  errors.push(`Sitemap URLs not present in INDEXABLE_ROUTES:\n${unexpected.map((url) => ` - ${url}`).join('\n')}`);
}

const missingFieldGuides = FIELD_GUIDE_ROUTE_PATHS
  .map((path) => `${BASE_URL}${path}`)
  .filter((url) => !locSet.has(url));
if (missingFieldGuides.length) {
  errors.push(`Missing field-guide/resource URLs:\n${missingFieldGuides.map((url) => ` - ${url}`).join('\n')}`);
}

if (fs.existsSync('public/sitemap.xml')) {
  errors.push('public/sitemap.xml still exists — the split sitemaps in sitemap-index.xml are the only source of truth');
}

if (errors.length) {
  console.error('❌ sitemap coverage check failed');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

console.log(`✅ sitemap coverage check passed (${locSet.size} URLs across ${SEGMENT_FILES.length} segments)`);
