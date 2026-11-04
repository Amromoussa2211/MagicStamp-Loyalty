const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Scenario: vendor opens Settings → Business profile → enters edit mode.
// The actual field edits are left for a recorded add-on (same as add-card);
// this spec proves the edit mode is reachable and exits cleanly WITHOUT
// saving — so live business data is never mutated.
test.describe('Vendor Portal — Settings Business profile', () => {
  test('business profile edit mode opens and closes without saving', async ({ page }) => {
    const creds = validCredentials() || { email: "amro_kaza@hotmail.com", password: "P@$$w0rd2010" };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Settings');
    allure.label('severity', 'normal');

    await allure.step('Login and open Settings', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
      await page.goto(`${PORTAL_BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });

    await allure.step('Open the Business profile card', async () => {
      await page.locator('a.st-card, a', { hasText: 'Business' }).first().click();
      await expect(page).toHaveURL(/settings\/business/);
      await expect(page.getByRole('heading', { name: /business/i })).toBeVisible();
    });

    await allure.step('Enter edit mode and exit WITHOUT saving', async () => {
      await page.getByRole('button', { name: 'Edit' }).click();

      const editableField = page.locator('input[type="text"], input:not([type]), textarea').nth(1);
      await expect(editableField.or(page.locator('form input')).first()).toBeVisible({ timeout: 15000 });

      // Exit without saving: Cancel button if present, otherwise Escape.
      const cancel = page.getByRole('button', { name: /cancel|back|discard/i });
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 15000 });
    });
  });
});
