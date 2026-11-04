const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Scenario: vendor opens Magic Codes; entry point and page are healthy.
test.describe('Vendor Portal — Magic Codes', () => {
  test('magic codes page renders with its create entry point', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Magic Codes');
    allure.label('severity', 'normal');

    await allure.step('Login', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
    });

    await allure.step('Open /magic-codes and verify', async () => {
      await page.goto(`${PORTAL_BASE_URL}/magic-codes`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/magic-codes/);
      await expect(page.getByRole('heading', { name: /magic code/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /create magic codes/i })).toBeVisible();
    });
  });
});
