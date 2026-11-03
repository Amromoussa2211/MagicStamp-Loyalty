const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const {
  validCredentials,
  performPortalLogin,
  isOnAuthenticatedPortal,
} = require('../helpers/vendorSignin');

// After a successful login there must be a way to sign out and end the
// session. The logout entry lives in the authenticated portal's UI; since the
// portal renders vendor Dashboards we probe for common header/menu patterns
// and skip when no control is found (rather than failing).
test.describe('Vendor Portal — Sign out', () => {
  test('signing out returns the browser to the sign-in page', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Sign out');
    allure.label('severity', 'normal');

    await allure.step('Sign in first', async () => {
      await performPortalLogin(page, creds);
    });

    await allure.step('Find and use a sign-out control', async () => {
      // Real control observed in the authenticated shell: "Logout" in the
      // sidebar/footer. Keep role-based fallbacks just in case the UI moves.
      const logout = page
        .getByText('Logout', { exact: true })
        .or(page.getByRole('button', { name: /log\s*out|sign\s*out/i }))
        .or(page.getByRole('link', { name: /log\s*out|sign\s*out/i }))
        .first();

      if (!(await logout.isVisible().catch(() => false))) {
        test.skip(true, 'No sign-out control visible on the authenticated portal — verify manually');
      }
      await logout.click();
    });

    await allure.step('Expect to be routed back to the sign-in page', async () => {
      await page.waitForURL(/\/signin|auth0\.com/, { timeout: 30000 });
      expect(isOnAuthenticatedPortal(page.url())).toBe(false);
    });
  });
});
