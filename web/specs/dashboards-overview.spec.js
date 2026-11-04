const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Scenario: vendor logs in and lands on the Overview dashboard.
test.describe('Vendor Portal — Dashboard Overview', () => {
  test('overview dashboard renders with sidebar navigation', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Overview');
    allure.label('severity', 'blocker');

    await allure.step('Login and wait for the authenticated shell', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
      await expect(page).toHaveURL(/overview/);
    });

    await allure.step('Sidebar shows the dashboard sections', async () => {
      for (const item of ['Overview', 'Campaigns', 'Outlets', 'Stamp Cards', 'Settings']) {
        await expect(page.getByRole('link', { name: new RegExp(`^${item}`, 'i') })).toBeVisible();
      }
    });

    await allure.step('Overview page heading/content rendered', async () => {
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
      await expect(page.getByText(/Logout/i)).toBeVisible(); // signed-in shell
    });
  });
});
