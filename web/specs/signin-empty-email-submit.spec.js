const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  EMAIL_INPUT,
  LOCK_ERROR,
  AUTH0_URL_MATCH,
  openSignin,
  clickPortalLoginButton,
  clickAuth0Submit,
} = require('../helpers/vendorSignin');

// Identifier-first flow: submitting an empty email must show a validation
// error and must NOT advance to the password step.
test.describe('Vendor Portal — Empty email', () => {
  test('submitting an empty email shows a validation error on the identity page', async ({ page }) => {
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

    await allure.step('Submit with the email field empty', async () => {
      await clickAuth0Submit(page);
    });

    await allure.step('Expect a validation error on the identity page', async () => {
      const error = page
        .locator(LOCK_ERROR)
        .or(page.getByText(/blank|required|valid email|email address/i).first());
      await expect(error.first()).toBeVisible({ timeout: 10000 });
      // Must still be on the authentication domain — nothing got through.
      await expect(page).toHaveURL(AUTH0_URL_MATCH);
    });
  });
});
