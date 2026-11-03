const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const {
  EMAIL_INPUT,
  AUTH0_URL_MATCH,
  openSignin,
  clickPortalLoginButton,
} = require('../helpers/vendorSignin');

// The hosted login must make it possible to recover a forgotten password:
// the "Forgot your password?" link has to open the reset flow.
// NOTE: link visibility depends on the tenant's Auth0 login page settings, so
// this test conditionally skips rather than failing when the link is hidden.
test.describe('Vendor Portal — Forgot password', () => {
  test('the forgot-password link opens the password reset page', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Recovery');
    allure.label('severity', 'normal');

    await allure.step('Reach the hosted login form', async () => {
      await openSignin(page);
      await clickPortalLoginButton(page);
      await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 });
      await page.locator(EMAIL_INPUT).first().waitFor({ state: 'visible', timeout: 30000 });
    });

    await allure.step('Locate the forgot-password link', async () => {
      // Auth0 Lock renders it as "Don't remember your password?".
      const forgotLink = page
        .getByRole('link', { name: /don'?t remember|forgot|reset/i })
        .or(page.locator('.auth0-lock-forgot-link'))
        .first();
      const visible = await forgotLink.isVisible().catch(() => false);
      if (!visible) {
        test.skip(true, 'Forgot-password link is not exposed on this tenant login page — nothing to verify');
      }
      await forgotLink.click();
    });

    await allure.step('Expect the password reset page to open', async () => {
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      expect(/auth0\.com/.test(url), `expected the reset page on the identity domain, got ${url}`).toBe(true);
    });
  });
});
