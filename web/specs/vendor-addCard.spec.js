
const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');

const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

test.describe('Vendor Portal — Add Stamp Card', () => {
  // Full login + 4-step wizard can take several minutes.
  test.setTimeout(300000);

  test('authenticated user reaches the stamp-card page', async ({ page }) => {
    const creds = validCredentials() || {
      email: process.env.VENDOR_EMAIL,
      password: process.env.VENDOR_PASSWORD,
    };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Stamp Card');
    allure.label('suite', 'Add Card');
    allure.label('severity', 'critical');

    await allure.step('🔐 Log in through the portal + identity provider', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
    });

    await allure.step('📄 Open the stamp-card page', async () => {
      await page.goto(`${PORTAL_BASE_URL}/stamp-card`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(page).toHaveURL(/stamp-card/);
    });
  });

  test('vendor can create a new stamp card', async ({ page }) => {
    const creds = validCredentials() || {
      email: process.env.VENDOR_EMAIL,
      password: process.env.VENDOR_PASSWORD,
    };

    // Generate unique test data for every execution.
    // This prevents duplicate reward identifiers in the backend.
    const executionId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const rewardTitle = `automated reward ${executionId}`;
    const confirmationTitle = `automated confirmation ${executionId}`;
    const confirmationMessage = `automated message ${executionId}`;

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Stamp Card');
    allure.label('suite', 'Add Card');
    allure.label('severity', 'blocker');

    await allure.step('🔐 Log in and reach the stamp-card page', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);

      await page.goto(`${PORTAL_BASE_URL}/stamp-card`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(
        page.getByRole('heading', { name: 'Stamp cards Library' })
      ).toBeVisible();
    });

    await allure.step('➕ Open the add-card form', async () => {
      await page.getByRole('button', {
        name: 'Create New Card',
      }).click();
    });

    await allure.step('🎨 Step 1 Look & feel — keep defaults, continue', async () => {
      await page.getByRole('button', {
        name: 'Next: Stamps',
      }).click();
    });

    await allure.step('🔢 Step 2 Stamps — keep defaults, continue', async () => {
      await page.getByRole('button', {
        name: 'Next: Rewards',
      }).click();
    });

    await allure.step('🎁 Step 3 Rewards — create a unique reward', async () => {
      // Enable the Rewards section.
      await page.getByRole('heading', {
        name: 'Rewards',
      }).click();

      // Unique reward title prevents duplicate backend identifiers.
      await page.getByRole('textbox', {
        name: 'Title',
        exact: true,
      }).fill(rewardTitle);

      // Select reward icons.
      await page.getByRole('button', {
        name: /icons.*target.*light.*bread/i,
      }).first().click();

      await page.getByRole('button', {
        name: /icons.*inking.*light.*coffee/i,
      }).first().click();

      const confirmationTitleField = page.getByRole('textbox', {
        name: /confirmation title/i,
      });

      if (await confirmationTitleField.isVisible().catch(() => false)) {
        await confirmationTitleField.fill(confirmationTitle);
      }

      const confirmationMessageField = page.getByRole('textbox', {
        name: /confirmation message/i,
      });

      if (await confirmationMessageField.isVisible().catch(() => false)) {
        await confirmationMessageField.fill(confirmationMessage);
      }

      const voucherDuration = page.getByRole('spinbutton', {
        name: /voucher duration/i,
      });

      if (await voucherDuration.isVisible().catch(() => false)) {
        await voucherDuration.fill('30');
      }

      const description = page.getByRole('textbox', {
        name: 'Description',
      });

      if (await description.isVisible().catch(() => false)) {
        await description.fill('automated');
      }

      const terms = page.getByRole('textbox', {
        name: 'Terms',
      });

      if (await terms.isVisible().catch(() => false)) {
        await terms.fill('terms');
      }
      await page.getByRole('button', {
        name: 'Next: Final touches',
      }).click();
    });

    await allure.step('✔ Step 4 Final touches — create the card', async () => {
      const finalTitle = page.getByRole('textbox', {
        name: 'Title',
        exact: true,
      });

      if (await finalTitle.isVisible().catch(() => false)) {
        await finalTitle.fill(rewardTitle);
      }

      await page.getByRole('button', {
        name: 'Create Stamp Card',
      }).click();
    });

    await allure.step('💾 Verify successful card creation', async () => {
      // Wait for the wizard to complete and return to the card library.
      await expect(
        page.getByRole('heading', {
          name: 'Stamp cards Library',
        })
      ).toBeVisible({ timeout: 30000 });

    });
  });
});
