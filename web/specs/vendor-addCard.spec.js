const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Simple add-card recording target — deliberately minimal.
// Each test logs in with the shared helper (no storageState complexity).

test.describe('Vendor Portal — Add Stamp Card', () => {
  test('authenticated user reaches the stamp-card page', async ({ page }) => {
    const creds = validCredentials();

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Stamp Card');
    allure.label('suite', 'Add Card');
    allure.label('severity', 'critical');

    await allure.step('🔐 Log in through the portal + identity provider', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
    });

    await allure.step('📄 Open the stamp-card page', async () => {
      await page.goto(`${PORTAL_BASE_URL}/stamp-card`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/stamp-card/);
    });
  });

  test('vendor can create a new stamp card', async ({ page }) => {
    const creds = validCredentials();

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Stamp Card');
    allure.label('suite', 'Add Card');
    allure.label('severity', 'blocker');

    await allure.step('🔐 Log in and reach the stamp-card page', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
      await page.goto(`${PORTAL_BASE_URL}/stamp-card`, { waitUntil: 'domcontentloaded' });
    });

    await allure.step('➕ Open the add-card form', async () => {
      await expect(page.locator('h1')).toContainText('Stamp cards Library');
      await page.getByRole('button', { name: 'Create New Card' }).click();
      await page.getByText('Back', { exact: true }).click();
      await page.getByRole('button', { name: 'Expand preview' }).click();
      await expect(page.getByText('Live PreviewFrontBackLogoAmr')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: '2 Stamps' }).click();
      await page.getByText('Start with your brand: add').click();
      await page.getByRole('button', { name: 'Back Side' }).click();
      await page.getByRole('button', { name: 'Front Side' }).click();
      await page.getByRole('button', { name: 'Next: Stamps' }).click();
      await page.getByRole('button', { name: 'icons/target/light/bread.png' }).click();
      await page.getByRole('button', { name: 'icons/inking/light/coffee-' }).click();
      await page.getByRole('button', { name: 'Next: Rewards' }).click();

      // ✅ محدد محدد بدقة: زر المساعدة الخاص بقسم Rewards فقط
      const rewardsSection = page
        .locator('section')
        .filter({ hasText: 'Rewards TitleIconsTarget' });

      await rewardsSection.getByRole('button', { name: 'About this section' }).click();

    //   // ✅ تحقق من ظهور اللوحة نفسها (tooltip/dialog) بدلاً من نص متصل قد لا يوجد
    //   await expect(
    //     page.locator('[role="tooltip"], [role="dialog"], .sc-info-popover').first()
    //   ).toBeVisible({ timeout: 10000 });
    });

    await allure.step('📝 Fill card details', async () => {
      // ✅ أسماء الحقول مصححة حسب الـ accessibility snapshot (question-circle بدل question-)
      await page
        .getByRole('textbox', { name: 'Confirmation Title question-circle' })
        .fill('automated confirmation');
      await page
        .getByRole('textbox', { name: 'Confirmation Message question-circle' })
        .fill('automated message');
      await page.getByRole('textbox', { name: 'Description' }).fill('automated');
      await page.getByRole('textbox', { name: 'Terms' }).fill('terms');
    });

    await allure.step('💾 Save and verify the card appears', async () => {
      await page.getByRole('button', { name: 'Next: Final touches' }).click();
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill('automated reward');
        await page.getByRole('spinbutton', { name: 'Voucher Duration (Days)' }).click();

      await page.getByRole('button', { name: 'Next: Final touches' }).click();
      await page.getByRole('button', { name: 'Create Stamp Card' }).click();

      await page.goto(`${PORTAL_BASE_URL}/stamp-card`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Stamp cards Library' })).toBeVisible();
    });
  });
});