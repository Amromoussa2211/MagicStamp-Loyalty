const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  AUTH0_URL_MATCH,
  validCredentials,
  openSignin,
  clickPortalLoginButton,
  fillAuth0LoginForm,
  waitForAuth0Error,
} = require('../helpers/vendorSignin');

// An email that certainly does not exist must be rejected — the portal must
// never authenticate an unknown user.
test.describe('Vendor Portal — Unknown user', () => {
  test('an unknown email is rejected with an error and no session', async ({ page }) => {
    const fakeEmail = `probe-${Date.now()}@parktechnology.com`;
    const creds = { email: fakeEmail, password: 'Anything-At-All-2026!' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Negative');
    allure.label('severity', 'critical');

    await allure.step('Reach the hosted login form', async () => {
      await openSignin(page);
      await clickPortalLoginButton(page);
      await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 });
    });

    await allure.step(`Submit a non-existent account (${fakeEmail})`, async () => {
      await fillAuth0LoginForm(page, creds);
    });

    await allure.step('Expect an error and the browser to stay on the identity domain', async () => {
      expect(await waitForAuth0Error(page)).toBeTruthy();
      await expect(page).toHaveURL(/auth0\.com/);
    });
  });
});
