const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const {
  AUTH0_URL_MATCH,
  validCredentials,
  openSignin,
  clickPortalLoginButton,
  fillAuth0LoginForm,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Traffic-level sanity checks during the sign-in flow:
//   1. the identity-provider authorization + portal API calls happen,
//   2. nothing fails with an HTTP 5xx,
//   3. the password is NEVER transmitted in a URL (query string leak).
test.describe('Vendor Portal — Sign-in network health', () => {
  test('sign-in traffic is healthy and the password never leaks into URLs', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Network');
    allure.label('severity', 'critical');

    const urlsWithPassword = [];
    const apiStatuses = [];

    page.on('request', (req) => {
      const u = req.url();
      if (u.includes(encodeURIComponent(creds.password)) || u.includes(creds.password)) {
        urlsWithPassword.push(u);
      }
      if (u.includes('parktechnology.com') || AUTH0_URL_MATCH.test(u)) {
        if (/authorize|\/token|\/callback|\/api\//.test(u)) apiStatuses.push({ url: u, type: 'req' });
      }
    });

    page.on('response', (res) => {
      const status = res.status();
      const u = res.url();
      if (status >= 500 && (AUTH0_URL_MATCH.test(u) || u.includes('parktechnology.com'))) {
        apiStatuses.push({ url: u, status });
      }
    });

    await allure.step('Drive the full sign-in flow', async () => {
      await openSignin(page);
      await clickPortalLoginButton(page);
      await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 });
      await fillAuth0LoginForm(page, creds);
      await waitForAuthenticatedPage(page);
    });

    await allure.step('Assert: no URL ever contained the password', async () => {
      expect(urlsWithPassword, `password leaked into URLs: ${urlsWithPassword.join(', ')}`).toHaveLength(0);
    });

    await allure.step('Assert: no 5xx responses during the flow', async () => {
      expect(apiStatuses.filter((s) => s.status >= 500)).toHaveLength(0);
    });
  });
});
