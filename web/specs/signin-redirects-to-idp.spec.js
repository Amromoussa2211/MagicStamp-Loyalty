const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  AUTH0_URL_MATCH,
  EMAIL_INPUT,
  PASSWORD_INPUT,
  SUBMIT_BUTTON,
  openSignin,
  clickPortalLoginButton,
} = require('../helpers/vendorSignin');

// The portal's /signin is not a credential form — it must hand the browser
// over to the Auth0 hosted login where credentials are actually entered.
test.describe('Vendor Portal — Sign-in redirect', () => {
  test('clicking Log in redirects to the hosted identity provider', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Redirect');
    allure.label('severity', 'critical');

    await allure.step('Open the sign-in page', async () => {
      await openSignin(page);
    });

    await allure.step('Click Log in and expect a redirect away from the portal', async () => {
      await clickPortalLoginButton(page);
      await page.waitForURL(/auth0\.com/, { timeout: 30000 });
      await expect(page).toHaveURL(/auth0\.com/);
    });

    await allure.step('Verify the identity provider rendered its combined login form', async () => {
      // Auth0 Lock renders email + password together in the main frame.
      await expect(page.locator(EMAIL_INPUT).first()).toBeVisible({ timeout: 30000 });
      await expect(page.locator(PASSWORD_INPUT).first()).toBeVisible();
      await expect(page.locator(SUBMIT_BUTTON).first()).toBeVisible();
    });
  });
});
