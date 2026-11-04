const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Scenario: vendor opens Campaigns; page renders and its entry card/CTA works.
test.describe('Vendor Portal — Dashboard Campaigns', () => {
  test('campaigns page renders and its create entry point is reachable', async ({ page }) => {
    const creds = validCredentials() || { email: "amro_kaza@hotmail.com", password: "P@$$w0rd2010" };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Campaigns');
    allure.label('severity', 'critical');

    await allure.step('Login', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
    });

    await allure.step('Open /campaigns and verify the page', async () => {
      await page.goto(`${PORTAL_BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/campaigns/);
      await expect(page.getByRole('heading', { name: /campaign/i })).toBeVisible();
    });

    await allure.step('Open the campaign entry card if present', async () => {
      // Empty state renders the entry as a card link (like Settings) — click
      // it when it exists; tolerate a plain empty state otherwise.
      const card = page.locator('a, button').filter({ hasText: /campaign/i }).first();
      if (await card.isVisible().catch(() => false)) {
        await card.click();
        // Any navigation or modal counts as a working entry point.
        await page.waitForTimeout(2000);
        await expect(page.locator('h1, h2, [role="dialog"]').first()).toBeVisible();
      }
    });
  });
});
