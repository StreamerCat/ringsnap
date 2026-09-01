import fs from 'fs';

const SITEMAP_FILES = [
  'sitemap-index.xml',
  'sitemap-core.xml',
  'sitemap-resources.xml',
  'sitemap-compare.xml',
];

const errors = [];

const redirects = fs.readFileSync('public/_redirects', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rule = (from, to, status) =>
  new RegExp(`^${escapeRegExp(from)}\\s+${escapeRegExp(to)}\\s+${status}\\s*$`, 'm');

for (const file of SITEMAP_FILES) {
  if (!rule(`/${file}`, `/${file}`, 200).test(redirects)) {
    errors.push(`Missing explicit /${file} passthrough rule in public/_redirects`);
  }
}

for (const alias of ['/sitemap', '/sitemap.xml', '/sitemap_index.xml']) {
  if (!rule(alias, '/sitemap-index.xml', 301).test(redirects)) {
    errors.push(`Missing ${alias} → /sitemap-index.xml redirect in public/_redirects`);
  }
}

const headerBlocks = headers.split('\n\n').map((section) =>
  section.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n').trim()
);

for (const file of SITEMAP_FILES) {
  const block = headerBlocks.find((section) => section.startsWith(`/${file}\n`));
  if (!block || !block.includes('Content-Type: application/xml')) {
    errors.push(`Missing XML content-type header rule for /${file} in public/_headers`);
  }
}

if (errors.length) {
  console.error('❌ sitemap serving checks failed');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

console.log('✅ sitemap serving checks passed');
