import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 30000,
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
        trace: 'retain-on-failure',
        video: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        // Auth setup - runs first to create storageState
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },
        {
            name: 'smoke',
            testMatch: /.*smoke\.spec\.ts|.*billing\.spec\.ts/,
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'tests/.auth/user.json',
            },
        },
        {
            name: 'full',
            testIgnore: /.*skip-ci.*/,
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'tests/.auth/user.json',
            },
        },
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // Only start webServer if PLAYWRIGHT_BASE_URL is not set and not in CI
    webServer: process.env.PLAYWRIGHT_BASE_URL || process.env.CI ? undefined : {
        command: 'npm run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 60000,
    },
});
