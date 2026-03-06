import { expect, test } from '@playwright/test';

test.describe('Billing Go-Live suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/functions/v1/get-billing-summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ payment_method: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } }),
      });
    });

    await page.route('**/functions/v1/stripe-invoices-list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoices: [
            {
              id: 'in_test_1',
              number: '0001',
              created: Math.floor(Date.now() / 1000),
              amount_paid: 5900,
              amount_due: 5900,
              status: 'paid',
              invoice_pdf: 'https://example.com/i.pdf',
              hosted_invoice_url: 'https://example.com/i',
              period_end: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
    });
  });

  test('G1 cancellation from dashboard', async ({ page }) => {
    let cancelCalled = false;
    await page.route('**/functions/v1/cancel-subscription', async (route) => {
      cancelCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    page.once('dialog', (dialog) => dialog.accept());
    await page.goto('/dashboard?tab=billing&billingE2E=1');

    await expect(page.getByRole('button', { name: /cancel trial/i })).toBeVisible();
    await page.getByRole('button', { name: /cancel trial/i }).click();
    await expect.poll(() => cancelCalled).toBeTruthy();
  });

  test('H4 + H7 billing invoice list + upgrade modal', async ({ page }) => {
    await page.route('**/functions/v1/create-upgrade-checkout', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://example.com/checkout' }) });
    });

    await page.goto('/dashboard?tab=billing&billingE2E=1');

    await expect(page.getByText('Billing History')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('a[href="https://example.com/i.pdf"]')).toBeVisible();

    await page.getByRole('button', { name: /change plan|upgrade/i }).first().click();
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
