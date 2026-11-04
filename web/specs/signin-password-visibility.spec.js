const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  EMAIL_INPUT,
  PASSWORD_INPUT,
  AUTH0_URL_MATCH,
  openSignin,
  clickPortalLoginButton,
} = require('../helpers/vendorSignin');

// NOTE: password-screen controls (visibility toggle) only exist once the
// identity provider got past the identifier step for a known-ish email.
// The toggle behaviour depends on tenant login-page settings — conditional skip.
test.describe('Vendor Portal — Password visibility', () => {
  test('password input is masked and the toggle reveals it', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Form Behaviour');
    allure.label('severity', 'normal');

    const { validCredentials, fillAuth0LoginForm } = require('../helpers/vendorSignin');
    const creds = validCredentials();

    await allure.step('Reach the hosted login form', async () => {
      await openSignin(page);
      await clickPortalLoginButton(page);
      await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 });
      await page.locator(EMAIL_INPUT).first().waitFor({ state: 'visible', timeout: 30000 });
    });

    await allure.step('Fill a plausible account name', async () => {
      if (creds) {
        // A known account reliably fills the password step.
        await page.locator(EMAIL_INPUT).first().fill(creds.email);
      } else {
        await page.locator(EMAIL_INPUT).first().fill('probe@parktechnology.com');
      }
    });

    await allure.step('Assert the password field is masked', async () => {
      const passwordField = page.locator(PASSWORD_INPUT).first();
      await passwordField.waitFor({ state: 'visible', timeout: 10000 });
      const typeBefore = await passwordField.getAttribute('type');
      expect(typeBefore, 'password field must be masked by default').toBe('password');
    });

    await allure.step('Toggle visibility and assert the field becomes visible text', async () => {
      // Auth0 Lock renders an eye toggle inside the password input widget.
      const toggle = page
        .getByRole('button', { name: /show|hide|reveal/i })
        .or(page.locator('.auth0-lock-show-password, .auth0-lock-input-password button, [data-toggle="password"]'))
        .first();
      const visible = await toggle.isVisible().catch(() => false);
      if (!visible) {
        test.skip(true, 'No visibility toggle exposed on this tenant login page — masking itself is verified');
      }

      await toggle.click();
      const typeAfterShow = await page.locator(PASSWORD_INPUT).first().getAttribute('type');
      expect(typeAfterShow).toBe('text');

      await toggle.click();
      const typeAfterHide = await page.locator(PASSWORD_INPUT).first().getAttribute('type');
      expect(typeAfterHide).toBe('password');
    });
  });
});
