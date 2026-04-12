/**
 * Prerender Script for SEO
 * 
 * This script runs after the Vite build and prerenders all marketing pages
 * to static HTML for better Google indexing and AI search visibility.
 * 
 * Usage: node scripts/prerender.mjs
 * 
 * Note: If Puppeteer is unavailable (e.g., in CI environments like Vercel),
 * the script will skip prerendering gracefully.
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_DIR = join(__dirname, '..', 'dist');

// Marketing pages that should be prerendered for SEO
const ROUTES = [
    '/',
    '/pricing',
    '/difference',
    '/plumbers',
    '/hvac',
    '/electricians',
    '/roofing',
    '/privacy',
    '/terms',
    // Resource Center
    '/resources',
    '/resources/hvac-dispatcher-script-template',
    '/resources/plumbing-dispatcher-script-template',
    '/resources/electrician-call-answering-script',
    '/resources/hvac-after-hours-answering-script',
    '/resources/hvac-price-shopper-phone-script',
    '/resources/hvac-emergency-call-triage',
    '/resources/burst-pipe-call-script',
    '/resources/sewer-backup-call-script',
    '/resources/drain-cleaning-upsell-script',
    '/resources/electrical-safety-triage-questions',
    '/resources/panel-upgrade-booking-script',
    '/resources/power-outage-call-script',
    '/resources/missed-call-revenue-calculator',
    '/resources/after-hours-call-calculator',
    '/resources/service-pricing-calculator',
    '/resources/increase-average-ticket',
    // CRM page
    '/crm',
    // Comparison pages
    '/compare/ringsnap-vs-ruby',
    '/compare/ringsnap-vs-smith-ai',
    '/compare/ringsnap-vs-goodcall',
    '/compare/ai-receptionist-vs-live-answering',
    '/compare/best-ai-receptionist-home-services',
];

const PORT = 8787;
const BASE_URL = `http://localhost:${PORT}`;

// Simple static file server
function createStaticServer() {
    return createServer((req, res) => {
        let filePath = join(DIST_DIR, req.url === '/' ? '/index.html' : req.url);

        // Check if file exists, otherwise serve index.html (SPA fallback)
        try {
            const stats = existsSync(filePath) ? statSync(filePath) : null;
            if (!stats || stats.isDirectory()) {
                filePath = join(DIST_DIR, 'index.html');
            }
        } catch {
            filePath = join(DIST_DIR, 'index.html');
        }

        // Determine content type
        const ext = filePath.split('.').pop();
        const contentTypes = {
            'html': 'text/html',
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'svg': 'image/svg+xml',
            'png': 'image/png',
            'ico': 'image/x-icon',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        try {
            const content = readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch (err) {
            res.writeHead(404);
            res.end('Not found');
        }
    });
}

async function prerenderRoute(browser, route) {
    const page = await browser.newPage();

    try {
        const url = `${BASE_URL}${route}`;
        console.log(`  📄 Prerendering: ${route}`);

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
        });

        // Wait for React to fully hydrate and render
        await page.waitForSelector('#root', { timeout: 10000 });

        // Wait for lazy-rendered sections and helmet metadata to settle.
        // Avoid networkidle waits because persistent sockets can keep pages
        // open forever in production-like environments.
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const settle = () => setTimeout(resolve, 2500);
                if (document.readyState === 'complete') {
                    settle();
                } else {
                    window.addEventListener('load', settle, { once: true });
                }
            });
        });

        // Get the rendered HTML
        let html = await page.content();

        // Add data-prerendered attribute to indicate this page was prerendered
        html = html.replace('<html', '<html data-prerendered="true"');

        // Determine output path
        const outputDir = route === '/'
            ? DIST_DIR
            : join(DIST_DIR, route);

        const outputPath = route === '/'
            ? join(DIST_DIR, 'index.html')
            : join(outputDir, 'index.html');

        // Create directory if needed
        if (route !== '/') {
            mkdirSync(outputDir, { recursive: true });
        }

        // Write the prerendered HTML
        writeFileSync(outputPath, html);
        console.log(`  ✅ Saved: ${outputPath}`);

        return true;
    } catch (err) {
        console.error(`  ❌ Failed to prerender ${route}:`, err.message);
        return false;
    } finally {
        await page.close();
    }
}

async function main() {
    console.log('🚀 Starting prerender process...\n');

    // Verify dist directory exists
    if (!existsSync(DIST_DIR)) {
        console.error('❌ dist directory not found. Run `npm run build` first.');
        process.exit(1);
    }

    const allowSkip = process.env.ALLOW_PRERENDER_SKIP === 'true';

    // Try to import Puppeteer
    let puppeteer;
    try {
        puppeteer = await import('puppeteer');
    } catch (err) {
        console.log('⚠️  Puppeteer not available:', err.message);
        if (allowSkip) {
            console.log('   ALLOW_PRERENDER_SKIP=true, skipping prerender and continuing build.');
            process.exit(0);
        }
        console.error('   Prerender is required for production indexing quality.');
        console.error('   Install puppeteer/browser dependencies or set ALLOW_PRERENDER_SKIP=true to bypass intentionally.');
        process.exit(1);
    }

    // Start local server
    const server = createStaticServer();
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`📡 Static server running on ${BASE_URL}\n`);

    // Launch browser
    let browser;
    try {
        browser = await puppeteer.default.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
    } catch (err) {
        console.log('⚠️  Could not launch browser:', err.message);
        if (allowSkip) {
            console.log('   ALLOW_PRERENDER_SKIP=true, skipping prerender and continuing build.');
            server.close();
            process.exit(0);
        }

        console.error('   Prerender is required for production indexing quality.');
        console.error('   Install Chrome dependencies or set ALLOW_PRERENDER_SKIP=true to bypass intentionally.');
        console.error('   Try installing Chrome or run: npx puppeteer browsers install chrome');
        server.close();
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;

    try {
        for (const route of ROUTES) {
            const success = await prerenderRoute(browser, route);
            if (success) successCount++;
            else failCount++;
        }
    } finally {
        await browser.close();
        server.close();
    }

    console.log('\n📊 Prerender Summary:');
    console.log(`  ✅ Success: ${successCount}/${ROUTES.length}`);
    if (failCount > 0) {
        console.log(`  ❌ Failed: ${failCount}/${ROUTES.length}`);
    }
    console.log('\n✨ Prerendering complete!\n');

    // Exit with error if any routes failed (unless skip override is explicitly enabled)
    if (failCount > 0) {
        if (allowSkip) {
            console.log('⚠️  Some pages failed to prerender, but ALLOW_PRERENDER_SKIP=true was set.');
            process.exit(0);
        }
        process.exit(1);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    if (process.env.ALLOW_PRERENDER_SKIP === 'true') {
        console.log('⚠️  Fatal prerender error ignored because ALLOW_PRERENDER_SKIP=true.');
        process.exit(0);
    }
    process.exit(1);
});
