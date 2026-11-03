const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const {
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
  isOnAuthenticatedPortal,
} = require('../helpers/vendorSignin');

// After a successful login, reloading the portal must keep the session
// (token persisted) rather than bouncing back to /signin. Needs credentials.
test.describe('Vendor Portal — Session persistence', () => {
  test('session survives a full page reload', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Session');
    allure.label('severity', 'critical');

    await allure.step('Sign in first', async () => {
      await performPortalLogin(page, creds);
      expect(isOnAuthenticatedPortal(page.url())).toBe(true);
    });

    await allure.step('Reload the page', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
    });

    await allure.step('Expect to still be on the authenticated portal (not /signin)', async () => {
      // The SPA may show the "Signing you in…" spinner briefly; make sure it
      // settles on an authenticated page rather than bouncing to /signin.
      await waitForAuthenticatedPage(page);
    });
  });
});
