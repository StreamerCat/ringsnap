/**
 * Prerender Script for SEO
 * 
 * This script runs after the Vite build and prerenders all marketing pages
 * to static HTML for better Google indexing and AI search visibility.
 * 
 * Usage: node scripts/prerender.mjs
 */

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, statSync } from 'fs';

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
];

const PORT = 8787;
const BASE_URL = `http://localhost:${PORT}`;

// Simple static file server
function createStaticServer() {
    return createServer((req, res) => {
        let filePath = join(DIST_DIR, req.url === '/' ? '/index.html' : req.url);

        // Check if file exists, otherwise serve index.html (SPA fallback)
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
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
            waitUntil: 'networkidle0',
            timeout: 30000,
        });

        // Wait for React to fully hydrate and render
        await page.waitForSelector('#root', { timeout: 10000 });

        // Wait for any lazy-loaded content
        await page.evaluate(() => {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    setTimeout(resolve, 2000); // Extra time for React lazy components
                } else {
                    window.addEventListener('load', () => setTimeout(resolve, 2000));
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

    // Start local server
    const server = createStaticServer();
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`📡 Static server running on ${BASE_URL}\n`);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

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

    // Exit with error if any routes failed
    process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
