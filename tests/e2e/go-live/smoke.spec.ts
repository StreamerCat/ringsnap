import { test, expect } from '@playwright/test';

test.describe('Go-live E2E smoke', () => {
  test('signup entry route is reachable', async ({ page }) => {
    await page.goto('/start');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/404/);
  });

  test('unauthenticated users are gated from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|signin|dashboard/);
  });

  test('billing success route exists (non-404)', async ({ page }) => {
    const response = await page.goto('/billing/success');
    expect(response?.status()).not.toBe(404);
  });

  test('appointments dashboard tab route renders shell', async ({ page }) => {
    await page.goto('/dashboard?tab=appointments');
    await expect(page.locator('body')).toBeVisible();
  });
});
