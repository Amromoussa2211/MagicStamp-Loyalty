const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { validCredentials, performPortalLogin, isOnAuthenticatedPortal } = require('../helpers/vendorSignin');

// Full happy path with the real test account from .env.
// Skips when credentials are not configured (e.g. CI without secrets).
test.describe('Vendor Portal — Valid credentials', () => {
  test('logging in with valid credentials reaches the authenticated portal', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Valid Credentials');
    allure.label('severity', 'blocker');

    await allure.step('Sign in through the portal + hosted identity provider', async () => {
      await performPortalLogin(page, creds);
    });

    await allure.step('Verify the browser landed on the authenticated portal', async () => {
      const url = page.url();
      expect(isOnAuthenticatedPortal(url), `expected an authenticated portal URL, got ${url}`).toBe(true);
      // The suite must never silently die at the sign-in page after success.
      expect(url).not.toMatch(/\/signin/);
    });
  });
});
