const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  EMAIL_INPUT,
  AUTH0_URL_MATCH,
  openSignin,
  clickPortalLoginButton,
  clickAuth0Submit,
  isOnAuthenticatedPortal,
} = require('../helpers/vendorSignin');

// A syntactically invalid email must never lead to a session.
//
// OBSERVED TENANT BEHAVIOUR (verified live): the Auth0 Lock widget here
// accepts the click but gives NO visual feedback — no inline validation
// error, no banner; the form simply stays put and the browser remains on the
// identity domain. The test asserts that observable contract (stuck + no
// session) rather than inventing an error message. The missing feedback is
// itself a UX gap to report.
test.describe('Vendor Portal — Invalid email format', () => {
  test('an invalid email format leads to no session (form rejects it)', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Negative');
    allure.label('severity', 'normal');

    await allure.step('Reach the hosted login form', async () => {
      await openSignin(page);
      await clickPortalLoginButton(page);
      await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 });
      await page.locator(EMAIL_INPUT).first().waitFor({ state: 'visible', timeout: 30000 });
    });

    await allure.step('Enter "not-an-email" and submit', async () => {
      await page.locator(EMAIL_INPUT).first().fill('not-an-email');
      await clickAuth0Submit(page);
    });

    await allure.step('Expect no navigation away and NO session established', async () => {
      // Danger of false success: if the tenant let bad emails through, the
      // browser would eventually leave the identity domain. It must NOT.
      await page.waitForTimeout(5000);
      await expect(page).toHaveURL(AUTH0_URL_MATCH);
      expect(isOnAuthenticatedPortal(page.url()), 'must not reach an authenticated portal URL').toBe(false);

      // The login form is still there — the user wasn't signed in silently.
      await expect(page.locator(EMAIL_INPUT).first()).toBeVisible();
    });
  });
});
