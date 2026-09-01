/**
 * Generates the 1200x630 social share image used for og:image / twitter:image.
 *
 * Usage: node scripts/generate-og-image.mjs
 * Output: public/og-image-1200x630.png
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const OUTPUT_PATH = join(PUBLIC_DIR, 'og-image-1200x630.png');

const logoSvg = readFileSync(join(PUBLIC_DIR, 'RS_logo_color.svg'), 'utf8');

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1200px;
        height: 630px;
        font-family: Inter, 'Liberation Sans', sans-serif;
        color: #2f3a3e;
        background: linear-gradient(135deg, #fdfdfb 0%, #f4ece3 100%);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 72px 80px;
      }
      .logo svg { height: 56px; width: auto; }
      h1 { font-size: 68px; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em; max-width: 940px; }
      h1 em { font-style: normal; color: #d67256; }
      p { font-size: 32px; line-height: 1.35; font-weight: 400; color: #5b686d; margin-top: 24px; max-width: 900px; }
      .footer { display: flex; align-items: center; justify-content: space-between; font-size: 26px; font-weight: 600; }
      .pills { display: flex; gap: 14px; }
      .pill { background: #ffffff; border: 2px solid #ecdfd3; color: #5b686d; border-radius: 999px; padding: 10px 22px; font-size: 22px; }
      .url { color: #d67256; }
      .rule { height: 8px; width: 120px; background: #d67256; border-radius: 999px; margin-bottom: 32px; }
    </style>
  </head>
  <body>
    <div class="logo">${logoSvg}</div>
    <div>
      <div class="rule"></div>
      <h1>The AI receptionist that <em>books jobs</em> while you work</h1>
      <p>Answers every call in under a second, qualifies the lead, and books the appointment — 24/7.</p>
    </div>
    <div class="footer">
      <div class="pills">
        <span class="pill">HVAC</span>
        <span class="pill">Plumbing</span>
        <span class="pill">Electrical</span>
        <span class="pill">Roofing</span>
      </div>
      <span class="url">getringsnap.com</span>
    </div>
  </body>
</html>`;

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  const buffer = await page.screenshot({ type: 'png' });
  writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ Written: ${OUTPUT_PATH}`);
} finally {
  await browser.close();
}
