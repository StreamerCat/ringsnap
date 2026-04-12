import fs from 'fs';

const redirectsPath = 'public/_redirects';
const headersPath = 'public/_headers';

const errors = [];

const redirects = fs.readFileSync(redirectsPath, 'utf8');
const headers = fs.readFileSync(headersPath, 'utf8');

if (!redirects.includes('/sitemap.xml         /sitemap.xml       200')) {
  errors.push('Missing explicit /sitemap.xml passthrough rule in public/_redirects');
}

if (!redirects.includes('/sitemap             /sitemap.xml       301')) {
  errors.push('Missing /sitemap alias redirect in public/_redirects');
}

if (!headers.includes('/sitemap.xml') || !headers.includes('Content-Type: application/xml')) {
  errors.push('Missing XML content-type header rule for /sitemap.xml in public/_headers');
}

if (errors.length) {
  console.error('❌ sitemap serving checks failed');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

console.log('✅ sitemap serving checks passed');
