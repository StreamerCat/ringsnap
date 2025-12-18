import { chromium } from '@playwright/test';
(async () => {
    try {
        console.log('Launching browser...');
        const browser = await chromium.launch({ headless: true });
        console.log('Browser launched.');
        const page = await browser.newPage();
        console.log('Page created.');
        await page.goto('http://localhost:8080');
        console.log('Navigated to localhost:8080');
        console.log('Title:', await page.title());
        await browser.close();
        console.log('Browser closed.');
    } catch (e) {
        console.error('Error:', e);
    }
})();
