#!/usr/bin/env node
/**
 * SEO Audit Script
 *
 * Fetches the production sitemap, walks every URL, and records:
 *   - HTTP status code (initial + after redirects)
 *   - Final URL after following redirects
 *   - Canonical tag (and whether it points to a 200)
 *   - Meta description tag count (per page)
 *   - Open Graph + Twitter card completeness
 *   - Title / meta-description length flags
 *
 * Output: docs/seo-audit-results.md + summary table on stdout.
 *
 * Usage:
 *   node scripts/audit-seo.mjs
 *   AUDIT_BASE=https://staging.example.com node scripts/audit-seo.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = new Set(process.argv.slice(2));
const LOCAL_MODE = args.has('--local') || process.env.AUDIT_LOCAL === 'true';
const LOCAL_PORT = Number(process.env.AUDIT_PORT || 8891);
const DIST_DIR = join(__dirname, '..', 'dist');

const BASE = LOCAL_MODE
  ? `http://localhost:${LOCAL_PORT}`
  : process.env.AUDIT_BASE || 'https://getringsnap.com';
const SITEMAP_URLS = [
  `${BASE}/sitemap.xml`,
  `${BASE}/sitemap-index.xml`,
];
const OUTPUT_FILE = join(__dirname, '..', 'docs', 'seo-audit-results.md');
const USER_AGENT =
  'Mozilla/5.0 (compatible; RingSnapSEOAudit/1.0; +https://getringsnap.com)';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

// Soft limits for flagging
const TITLE_MAX = 60;
const DESC_MAX = 160;

// ─── HTTP helpers ──────────────────────────────────────────────────────────
function withTimeout(promise, ms, url) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`Timeout (${ms}ms) for ${url}`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

async function fetchHead(url) {
  try {
    const res = await withTimeout(
      fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
      }),
      REQUEST_TIMEOUT_MS,
      url
    );
    return { ok: true, status: res.status, headers: res.headers };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function fetchWithRedirects(url, depth = 0) {
  const chain = [];
  let current = url;
  while (depth <= MAX_REDIRECTS) {
    let res;
    try {
      res = await withTimeout(
        fetch(current, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': USER_AGENT },
        }),
        REQUEST_TIMEOUT_MS,
        current
      );
    } catch (err) {
      return { error: err.message, chain };
    }
    const status = res.status;
    chain.push({ url: current, status });
    if (status >= 300 && status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      current = new URL(location, current).toString();
      depth++;
      continue;
    }
    const text = await res.text();
    return {
      finalUrl: current,
      finalStatus: status,
      initialStatus: chain[0].status,
      redirected: chain.length > 1,
      chain,
      body: text,
      contentType: res.headers.get('content-type') || '',
    };
  }
  return { error: 'Too many redirects', chain };
}

// ─── HTML parsing ──────────────────────────────────────────────────────────
function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function extractTitle(html) {
  const m = stripComments(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractMetaByName(rawHtml, name) {
  const html = stripComments(rawHtml);
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]*?content=["']([\\s\\S]*?)["'][^>]*>`,
    'gi'
  );
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1].trim());

  const reReversed = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+name=["']${name}["']`,
    'gi'
  );
  while ((m = reReversed.exec(html)) !== null) matches.push(m[1].trim());
  return matches;
}

function extractMetaByProperty(rawHtml, property) {
  const html = stripComments(rawHtml);
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]*?content=["']([\\s\\S]*?)["'][^>]*>`,
    'gi'
  );
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1].trim());

  const reReversed = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+property=["']${property}["']`,
    'gi'
  );
  while ((m = reReversed.exec(html)) !== null) matches.push(m[1].trim());
  return matches;
}

function extractCanonical(rawHtml) {
  const html = stripComments(rawHtml);
  const re =
    /<link[^>]+rel=["']canonical["'][^>]*?href=["']([\s\S]*?)["'][^>]*>/gi;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1].trim());
  return matches;
}

function extractMetaRobots(html) {
  return extractMetaByName(html, 'robots');
}

// ─── Sitemap parsing ───────────────────────────────────────────────────────
function extractLocs(xml) {
  const re = /<loc>([\s\S]*?)<\/loc>/gi;
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function rewriteForLocal(url) {
  if (!LOCAL_MODE) return url;
  // Sitemap and canonical contents always point at https://getringsnap.com.
  // In local mode, rewrite to the local server so we audit the actual built files.
  try {
    const u = new URL(url);
    if (
      u.hostname === 'getringsnap.com' ||
      u.hostname === 'www.getringsnap.com'
    ) {
      return `${BASE}${u.pathname}${u.search}`;
    }
  } catch {}
  return url;
}

async function readSitemap(url) {
  const res = await fetchWithRedirects(url);
  if (res.error || res.finalStatus !== 200) {
    return { url, urls: [], error: res.error || `status ${res.finalStatus}` };
  }
  const urls = extractLocs(res.body).map(rewriteForLocal);
  return { url, urls };
}

// ─── Per-URL audit ─────────────────────────────────────────────────────────
async function auditUrl(url) {
  const result = {
    url,
    status: null,
    finalUrl: null,
    redirected: false,
    redirectChain: [],
    canonical: null,
    canonicalCount: 0,
    canonicalTargetStatus: null,
    metaDescriptionCount: 0,
    metaDescription: null,
    title: null,
    titleLength: 0,
    descriptionLength: 0,
    robots: null,
    og: { title: null, description: null, image: null, url: null, type: null },
    twitter: { card: null, title: null, description: null, image: null },
    flags: [],
    error: null,
  };

  const r = await fetchWithRedirects(url);
  if (r.error) {
    result.error = r.error;
    result.flags.push('FETCH_ERROR');
    return result;
  }

  result.status = r.finalStatus;
  result.finalUrl = r.finalUrl;
  result.redirected = r.redirected;
  result.redirectChain = r.chain;

  if (r.finalStatus >= 500) result.flags.push('5XX');
  if (r.finalStatus >= 400 && r.finalStatus < 500) result.flags.push('4XX');
  if (r.redirected) result.flags.push('3XX_REDIRECT');

  // Only parse HTML for 2xx HTML responses
  if (r.finalStatus < 200 || r.finalStatus >= 300) return result;
  if (!r.contentType.toLowerCase().includes('html')) return result;

  const html = r.body;
  result.title = extractTitle(html);
  result.titleLength = result.title?.length ?? 0;
  if (result.titleLength > TITLE_MAX) result.flags.push('TITLE_TOO_LONG');
  if (!result.title) result.flags.push('TITLE_MISSING');

  const descs = extractMetaByName(html, 'description');
  result.metaDescriptionCount = descs.length;
  result.metaDescription = descs[0] || null;
  result.descriptionLength = result.metaDescription?.length ?? 0;
  if (descs.length === 0) result.flags.push('DESCRIPTION_MISSING');
  if (descs.length > 1) result.flags.push('DUPLICATE_DESCRIPTION');
  if (result.descriptionLength > DESC_MAX)
    result.flags.push('DESCRIPTION_TOO_LONG');

  const canonicals = extractCanonical(html);
  result.canonical = canonicals[0] || null;
  result.canonicalCount = canonicals.length;
  if (canonicals.length === 0) result.flags.push('CANONICAL_MISSING');
  if (canonicals.length > 1) result.flags.push('DUPLICATE_CANONICAL');

  const robotsTags = extractMetaRobots(html);
  result.robots = robotsTags[0] || null;
  if (result.robots && /noindex/i.test(result.robots))
    result.flags.push('NOINDEX');

  result.og.title = extractMetaByProperty(html, 'og:title')[0] || null;
  result.og.description =
    extractMetaByProperty(html, 'og:description')[0] || null;
  result.og.image = extractMetaByProperty(html, 'og:image')[0] || null;
  result.og.url = extractMetaByProperty(html, 'og:url')[0] || null;
  result.og.type = extractMetaByProperty(html, 'og:type')[0] || null;
  result.twitter.card = extractMetaByName(html, 'twitter:card')[0] || null;
  result.twitter.title = extractMetaByName(html, 'twitter:title')[0] || null;
  result.twitter.description =
    extractMetaByName(html, 'twitter:description')[0] || null;
  result.twitter.image = extractMetaByName(html, 'twitter:image')[0] || null;

  const ogMissing = [];
  if (!result.og.title) ogMissing.push('og:title');
  if (!result.og.description) ogMissing.push('og:description');
  if (!result.og.image) ogMissing.push('og:image');
  if (!result.og.url) ogMissing.push('og:url');
  if (!result.og.type) ogMissing.push('og:type');
  if (!result.twitter.card) ogMissing.push('twitter:card');
  if (ogMissing.length > 0) {
    result.flags.push(`OG_INCOMPLETE:${ogMissing.join(',')}`);
  }

  return result;
}

// ─── Local static server (for --local mode) ──────────────────────────────
function parseNetlifyRedirects(content) {
  const rules = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [from, to, codePart] = parts;
    if (from.startsWith('http')) continue;
    const code = parseInt(codePart || '301', 10);
    rules.push({ from, to, code: Number.isFinite(code) ? code : 301 });
  }
  return rules;
}

function startLocalServer() {
  const redirectsPath = join(DIST_DIR, '_redirects');
  const redirects = existsSync(redirectsPath)
    ? parseNetlifyRedirects(readFileSync(redirectsPath, 'utf8'))
    : [];

  const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  const server = createServer((req, res) => {
    const reqPath = (req.url || '/').split('?')[0];

    // Check Netlify redirect rules
    for (const rule of redirects) {
      if (rule.from === reqPath) {
        if (rule.code === 200) {
          // Rewrite (proxy) — treat as 200 with the SPA fallback for /*
          if (rule.to.startsWith('http')) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Local server: external rewrite target not proxied');
            return;
          }
          req.url = rule.to;
          break;
        }
        res.writeHead(rule.code, { Location: rule.to });
        res.end();
        return;
      }
    }

    let candidate = join(DIST_DIR, decodeURIComponent(req.url));
    // Block traversal
    if (!candidate.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let stat = null;
    try {
      stat = statSync(candidate);
    } catch {}

    if (stat && stat.isDirectory()) {
      candidate = join(candidate, 'index.html');
      try {
        stat = statSync(candidate);
      } catch {
        stat = null;
      }
    }

    if (!stat) {
      // SPA fallback (matches `/*  /index.html  200`)
      candidate = join(DIST_DIR, 'index.html');
      try {
        stat = statSync(candidate);
      } catch {
        res.writeHead(500);
        res.end('No fallback');
        return;
      }
    }

    const ext = extname(candidate).toLowerCase();
    const ct = CONTENT_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(readFileSync(candidate));
  });

  return new Promise((resolve) => {
    server.listen(LOCAL_PORT, () => {
      console.log(`🌐 Local audit server on http://localhost:${LOCAL_PORT}`);
      resolve(server);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔍 SEO audit starting against ${BASE}\n`);
  let localServer = null;
  if (LOCAL_MODE) {
    if (!existsSync(DIST_DIR)) {
      console.error(
        `❌ --local requires dist/ to exist. Run \`npm run build\` first.`
      );
      process.exit(1);
    }
    localServer = await startLocalServer();
  }

  // 1. Pull sitemaps
  const sitemapResults = [];
  const allUrls = new Set();
  for (const sm of SITEMAP_URLS) {
    const r = await readSitemap(sm);
    sitemapResults.push(r);
    if (r.urls.length > 0) {
      // If this is the sitemap index, dive one level deeper.
      const looksLikeIndex = r.urls.every((u) => /sitemap.*\.xml/i.test(u));
      if (looksLikeIndex && r.urls.length <= 10) {
        for (const child of r.urls) {
          const cr = await readSitemap(child);
          if (cr.urls.length > 0) {
            cr.urls.forEach((u) => allUrls.add(u));
            sitemapResults.push(cr);
          }
        }
      } else {
        r.urls.forEach((u) => allUrls.add(u));
      }
    }
  }

  const urls = Array.from(allUrls);
  console.log(`📋 Discovered ${urls.length} unique URLs across sitemaps.\n`);

  // 2. Audit each URL
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`  [${i + 1}/${urls.length}] ${url} ... `);
    const r = await auditUrl(url);
    results.push(r);
    console.log(
      `${r.status ?? 'ERR'}${r.flags.length ? ' ⚠ ' + r.flags.join(',') : ''}`
    );
  }

  // 3. Check canonical targets
  const canonicalTargets = new Map();
  for (const r of results) {
    if (r.canonical) {
      const target = rewriteForLocal(r.canonical);
      if (!canonicalTargets.has(target)) canonicalTargets.set(target, null);
    }
  }
  console.log(
    `\n🔗 Verifying ${canonicalTargets.size} canonical URL targets...`
  );
  for (const target of canonicalTargets.keys()) {
    const head = await fetchHead(target);
    canonicalTargets.set(
      target,
      head.ok ? head.status : `ERR(${head.error})`
    );
  }
  for (const r of results) {
    if (r.canonical) {
      const target = rewriteForLocal(r.canonical);
      r.canonicalTargetStatus = canonicalTargets.get(target) ?? null;
      if (
        typeof r.canonicalTargetStatus === 'number' &&
        r.canonicalTargetStatus !== 200
      ) {
        r.flags.push(`CANONICAL_TO_${r.canonicalTargetStatus}`);
      }
    }
  }

  // 4. Summarize
  const summary = {
    total: results.length,
    status5xx: results.filter((r) => r.status >= 500).length,
    status4xx: results.filter((r) => r.status >= 400 && r.status < 500).length,
    status3xx: results.filter((r) => r.redirected).length,
    status2xx: results.filter((r) => r.status >= 200 && r.status < 300).length,
    fetchError: results.filter((r) => r.error).length,
    missingCanonical: results.filter((r) =>
      r.flags.includes('CANONICAL_MISSING')
    ).length,
    duplicateCanonical: results.filter((r) =>
      r.flags.includes('DUPLICATE_CANONICAL')
    ).length,
    canonicalToNon200: results.filter((r) =>
      r.flags.some((f) => f.startsWith('CANONICAL_TO_'))
    ).length,
    duplicateDescription: results.filter((r) =>
      r.flags.includes('DUPLICATE_DESCRIPTION')
    ).length,
    descriptionMissing: results.filter((r) =>
      r.flags.includes('DESCRIPTION_MISSING')
    ).length,
    descriptionTooLong: results.filter((r) =>
      r.flags.includes('DESCRIPTION_TOO_LONG')
    ).length,
    titleTooLong: results.filter((r) => r.flags.includes('TITLE_TOO_LONG'))
      .length,
    titleMissing: results.filter((r) => r.flags.includes('TITLE_MISSING'))
      .length,
    ogIncomplete: results.filter((r) =>
      r.flags.some((f) => f.startsWith('OG_INCOMPLETE'))
    ).length,
  };

  // 5. Console summary table
  console.log('\n📊 Summary\n──────────');
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }
  console.log('');

  // 6. Markdown report
  if (!existsSync(dirname(OUTPUT_FILE))) {
    mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  }
  const lines = [];
  lines.push(`# SEO Audit Results`);
  lines.push('');
  lines.push(`**Base:** ${BASE}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**URLs audited:** ${results.length}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  for (const [k, v] of Object.entries(summary)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  // Sitemap fetch results
  lines.push('## Sitemaps');
  lines.push('');
  for (const sr of sitemapResults) {
    lines.push(
      `- \`${sr.url}\` — ${sr.urls.length} URLs${sr.error ? ` (error: ${sr.error})` : ''}`
    );
  }
  lines.push('');

  // Group by flag
  const flagBuckets = new Map();
  for (const r of results) {
    for (const f of r.flags) {
      const key = f.split(':')[0];
      if (!flagBuckets.has(key)) flagBuckets.set(key, []);
      flagBuckets.get(key).push(r);
    }
  }

  lines.push('## Issues by Flag');
  lines.push('');
  const sortedFlags = Array.from(flagBuckets.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );
  for (const [flag, rs] of sortedFlags) {
    lines.push(`### ${flag} (${rs.length})`);
    lines.push('');
    for (const r of rs) {
      const detail = r.flags.find((f) => f.startsWith(flag));
      const extra = detail && detail.includes(':') ? ` — ${detail}` : '';
      lines.push(
        `- \`${r.url}\` → status ${r.status}${
          r.canonical ? `, canonical=${r.canonical}` : ''
        }${extra}`
      );
    }
    lines.push('');
  }

  lines.push('## Full Detail');
  lines.push('');
  for (const r of results) {
    lines.push(`### ${r.url}`);
    lines.push('');
    lines.push(`- **Status:** ${r.status}${r.redirected ? ' (redirected)' : ''}`);
    if (r.redirected) {
      lines.push(
        `- **Chain:** ${r.redirectChain
          .map((c) => `${c.url} → ${c.status}`)
          .join(' / ')}`
      );
      lines.push(`- **Final URL:** ${r.finalUrl}`);
    }
    if (r.title) {
      lines.push(`- **Title (${r.titleLength}):** ${r.title}`);
    }
    if (r.metaDescription) {
      lines.push(
        `- **Description (${r.descriptionLength}, count=${r.metaDescriptionCount}):** ${r.metaDescription}`
      );
    }
    if (r.canonical) {
      lines.push(
        `- **Canonical (count=${r.canonicalCount}):** ${r.canonical} → ${r.canonicalTargetStatus}`
      );
    }
    if (r.robots) lines.push(`- **Robots:** ${r.robots}`);
    if (r.og.title || r.og.description || r.og.image || r.og.url) {
      lines.push(
        `- **OG:** title=${r.og.title ? '✓' : '✗'} desc=${r.og.description ? '✓' : '✗'} image=${r.og.image ? '✓' : '✗'} url=${r.og.url ? '✓' : '✗'} type=${r.og.type ? '✓' : '✗'}`
      );
    }
    if (r.twitter.card) lines.push(`- **Twitter card:** ${r.twitter.card}`);
    if (r.flags.length > 0) {
      lines.push(`- **Flags:** ${r.flags.join(', ')}`);
    }
    if (r.error) lines.push(`- **Error:** ${r.error}`);
    lines.push('');
  }

  writeFileSync(OUTPUT_FILE, lines.join('\n'));
  console.log(`📝 Wrote ${OUTPUT_FILE}`);

  // Non-zero exit if any 5xx in sitemap
  if (summary.status5xx > 0) {
    console.error(`\n❌ ${summary.status5xx} sitemap URL(s) returned 5XX.`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ Zero 5XX in sitemap.');
  }

  if (localServer) localServer.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
