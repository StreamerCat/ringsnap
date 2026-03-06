import { expect, test } from '@playwright/test';

const billingEmail = process.env.BILLING_E2E_EMAIL;
const billingPassword = process.env.BILLING_E2E_PASSWORD;

async function loginToDashboard(page: any) {
  test.skip(!billingEmail || !billingPassword, 'GAP: Set BILLING_E2E_EMAIL and BILLING_E2E_PASSWORD to run dashboard billing E2E checks.');

  await page.goto('/signin');
  await page.getByLabel(/email/i).fill(billingEmail!);
  await page.getByLabel(/password/i).fill(billingPassword!);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

test.describe('Billing Go-Live suite', () => {
  test('G1 cancellation from dashboard', async ({ page }) => {
    await loginToDashboard(page);

    await page.goto('/dashboard?tab=billing');
    await expect(page.getByRole('button', { name: /cancel trial|cancel subscription/i })).toBeVisible();

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: /cancel trial|cancel subscription/i }).click();
    await expect(page.getByRole('button', { name: /cancel trial|cancel subscription/i })).toBeVisible();
  });

  test('H4 + H7 billing invoice list + upgrade modal', async ({ page }) => {
    await loginToDashboard(page);

    await page.goto('/dashboard?tab=billing');

    await expect(page.getByText('Billing History')).toBeVisible();
    await expect(page.getByText(/loading invoices|no invoices|invoice/i)).toBeVisible();

    await page.getByRole('button', { name: /change plan|upgrade|choose a plan/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page.getByText('Night & Weekend')).toBeVisible();
    await expect(page.getByText('Lite')).toBeVisible();
    await expect(page.getByText('Core')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();

    await expect(page.getByText('$59')).toBeVisible();
    await expect(page.getByText('$129')).toBeVisible();
    await expect(page.getByText('$229')).toBeVisible();
    await expect(page.getByText('$399')).toBeVisible();
  });
});
