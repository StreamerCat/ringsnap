import fs from 'fs';

const robotsPath = 'public/robots.txt';
const robots = fs.readFileSync(robotsPath, 'utf8');

const errors = [];

if (!robots.includes('Sitemap: https://getringsnap.com/sitemap.xml')) {
  errors.push('Missing sitemap directive in public/robots.txt');
}

const invalidLLMs = robots.split('\n').find((line) => /^\s*LLMs\s*:/i.test(line));
if (invalidLLMs) {
  errors.push(`Invalid robots directive found: "${invalidLLMs.trim()}"`);
}

if (errors.length > 0) {
  console.error('❌ robots.txt validation failed');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

console.log('✅ robots.txt validation passed');
