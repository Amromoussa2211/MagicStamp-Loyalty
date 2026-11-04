const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const { SIGNIN_URL, openSignin } = require('../helpers/vendorSignin');

// The portal sign-in page is a React SPA: verify it renders its login shell.
test.describe('Vendor Portal — Sign-in page', () => {
  test('sign-in page loads with the Log in button', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Sign-in');
    allure.label('suite', 'Sign-in — Page Loads');
    allure.label('severity', 'blocker');

    await allure.step('Open the sign-in page', async () => {
      await openSignin(page);
      await expect(page).toHaveURL(/\/signin/);
    });

    await allure.step('Verify the login shell (branding + button) rendered', async () => {
      await expect(page.locator('.login-page')).toBeVisible();
      const loginButton = page.locator('.login-page .login-button');
      await expect(loginButton).toBeVisible();

      const buttonText = (await loginButton.innerText()).trim();
      expect(buttonText.length).toBeGreaterThan(0);
    });
  });
});
