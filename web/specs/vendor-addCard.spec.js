const { test, expect } = require('../fixtures/web');
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
  // Full login (~1-2 min with the OAuth spinner) + 4-step wizard do NOT fit
  // in the 60s default — this is why the last run died mid-wizard.
  test.setTimeout(300000);

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
    });

    await allure.step('🎨 Step 1 Look & feel — keep defaults, continue', async () => {
      await page.getByRole('button', { name: 'Next: Stamps' }).click();
      await page.waitForTimeout(1000);
    });

    await allure.step('🔢 Step 2 Stamps — keep defaults, continue', async () => {
      await page.getByRole('button', { name: 'Next: Rewards' }).click();
      await page.waitForTimeout(1000);
    });

    await allure.step('🎁 Step 3 Rewards — enable the main reward and fill it', async () => {
      // Fresh cards start with the Rewards section DISABLED and an empty
      // (required) Title — clicking the section heading enables it. Without
      // this the "Next: Final touches" click bounces the wizard back.
      await page.getByRole('heading', { name: 'Rewards' }).click();
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill('automated reward');
      await page.getByRole('button', { name: /icons\/target\/light\/bread/ }).first().click();
      await page.getByRole('button', { name: /icons\/inking\/light\/coffee/ }).first().click();
      const t1 = page.getByRole('textbox', { name: /confirmation title/i });
      if (await t1.isVisible().catch(() => false)) await t1.fill('automated confirmation');
      const t2 = page.getByRole('textbox', { name: /confirmation message/i });
      if (await t2.isVisible().catch(() => false)) await t2.fill('automated message');
      const dur = page.getByRole('spinbutton', { name: /voucher duration/i });
      if (await dur.isVisible().catch(() => false)) await dur.fill('30');
      const desc = page.getByRole('textbox', { name: 'Description' });
      if (await desc.isVisible().catch(() => false)) await desc.fill('automated');
      const terms = page.getByRole('textbox', { name: 'Terms' });
      if (await terms.isVisible().catch(() => false)) await terms.fill('terms');
      await page.getByRole('button', { name: 'Next: Final touches' }).click();
      await page.waitForTimeout(1000);
    });

    await allure.step('✔ Step 4 Final touches — create the card', async () => {
      const ftTitle = page.getByRole('textbox', { name: 'Title', exact: true });
      if (await ftTitle.isVisible().catch(() => false)) await ftTitle.fill('automated reward');
      await page.getByRole('button', { name: 'Create Stamp Card' }).click();
    });

    await allure.step('💾 Verify the card library shows the new card', async () => {
      await page.goto(`${PORTAL_BASE_URL}/stamp-card`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Stamp cards Library' })).toBeVisible();
    });
  });
});