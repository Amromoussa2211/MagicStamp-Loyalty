const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  AUTH0_URL_MATCH,
  openSignin,
  clickPortalLoginButton,
  fillAuth0LoginForm,
  waitForAuth0Error,
} = require('../helpers/vendorSignin');

// A registered account with a WRONG password must be rejected and the
// session must NOT be established. Uses the real (existing) account email
// with a fake password — so the flow reaches the credential check.
test.describe('Vendor Portal — Wrong password', () => {
  test('a wrong password is rejected with an error and no session', async ({ page }) => {
    const { validCredentials } = require('../helpers/vendorSignin');
    const realCreds = validCredentials();

    // A real email exists in the directory; a fake one may short-circuit into
    // "user not found". Keep the real email if available, fall back otherwise.
    const email = realCreds ? realCreds.email : 'nonexistent.user.probe@parktechnology.com';
    const creds = { email, password: 'Definitely-Not-The-Password-123!' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Negative');
    allure.label('severity', 'critical');

    await allure.step('Open the sign-in page and trigger the redirect', async () => {
      await openSignin(page);
      await clickPortalLoginButton(page);
      await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 });
    });

    await allure.step('Submit credentials with a deliberately wrong password', async () => {
      await fillAuth0LoginForm(page, creds);
    });

    await allure.step('Expect an error on the identity page and NO portal session', async () => {
      expect(await waitForAuth0Error(page)).toBeTruthy();
      // Browser must still be on the authentication domain — not back in the app.
      await expect(page).toHaveURL(/auth0\.com/);
    });
  });
});
