const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// Scenario: vendor creates a NEW outlet (own data, unique name), edits it,
// then deletes it — full CRUD on self-created data only.
test.describe('Vendor Portal — Outlets CRUD', () => {
  test.setTimeout(300000);

  const OUTLET = `auto-outlet-${Date.now()}`;
  const RENAMED = `${OUTLET}-v2`;

  test('vendor can create, edit and delete an outlet', async ({ page }) => {
    const creds = validCredentials() || { email: "amro_kaza@hotmail.com", password: "P@$$w0rd2010" };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Outlets');
    allure.label('severity', 'critical');

    await allure.step('Login and open Outlets', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
      await page.goto(`${PORTAL_BASE_URL}/outlets`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /outlets/i })).toBeVisible();
    });

    await allure.step('Clean up any leftover auto-outlets from previous runs', async () => {
      await page.getByPlaceholder('Search outlets by name or address').fill('auto-outlet-');
      let guard = 5;
      while (guard-- > 0) {
        const del = page.getByRole('button', { name: 'Delete' }).first();
        if (!(await del.isVisible().catch(() => false))) break;
        await del.click();
        // The Confirm Delete dialog mounts asynchronously after the click —
        // WAIT for its confirm button (bounded) instead of an instant check.
        const dialog = page.getByRole('dialog', { name: /confirm delete/i });
        const dialogDelete = dialog.getByRole('button', { name: 'Delete', exact: true });
        await expect(dialogDelete).toBeVisible({ timeout: 10000 });
        await dialogDelete.click();
        await expect(dialog).not.toBeVisible({ timeout: 10000 });
        await page.getByPlaceholder('Search outlets by name or address').fill('auto-outlet-');
      }
    });

    await allure.step(`Create outlet "${OUTLET}"`, async () => {
      await page.getByRole('button', { name: /add new outlet/i }).click();
      await page.getByPlaceholder('e.g., Downtown Branch').fill(OUTLET);
      await page.getByPlaceholder('Building / number').fill('1');
      await page.getByPlaceholder('Street name').fill('Automation Street');
      await page.getByPlaceholder('City / town').fill('Cairo');
      await page.getByPlaceholder('Postal code').fill('12345');
      await page.getByRole('button', { name: /create outlet/i }).click();
      // Success modal: "Outlet Added Successfully" → return to the list.
      await page.getByRole('button', { name: 'Back to Outlets' }).click({ timeout: 30000 });
      await page.getByPlaceholder('Search outlets by name or address').fill(OUTLET);
      await expect(page.getByText(OUTLET).first()).toBeVisible({ timeout: 15000 });
    });

    await allure.step(`Edit outlet → rename to "${RENAMED}"`, async () => {
      await page.getByRole('button', { name: 'Edit' }).first().click();
      const nameInput = page.getByPlaceholder('e.g., Downtown Branch');
      await expect(nameInput).toBeVisible({ timeout: 15000 });
      await nameInput.fill(RENAMED);
      await page.getByRole('button', { name: /create outlet|save changes/i }).click();
      // The portal shows the SAME "Outlet Added Successfully" modal for
      // updates — wait for it (it renders ~1s after save), then go back.
      await page.getByRole('button', { name: 'Back to Outlets' }).click({ timeout: 30000 });
      await page.getByPlaceholder('Search outlets by name or address').fill(OUTLET);
      await expect(page.getByText(RENAMED).first()).toBeVisible({ timeout: 15000 });
    });

    await allure.step('Delete the outlet (self-cleanup)', async () => {
      await page.getByPlaceholder('Search outlets by name or address').fill(RENAMED);
      await page.getByRole('button', { name: 'Delete' }).first().click();
      // "Confirm Delete" dialog — AntD mounts it asynchronously after the
      // click, so WAIT for its confirm button instead of an instant
      // isVisible() check. That race broke CI: the check ran before the
      // dialog existed, the fallback clicked a row button behind the modal
      // overlay and hung for the rest of the timeout.
      const dialog = page.getByRole('dialog', { name: /confirm delete/i });
      const dialogDelete = dialog.getByRole('button', { name: 'Delete', exact: true });
      await expect(dialogDelete).toBeVisible({ timeout: 15000 });
      await dialogDelete.click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(RENAMED).first()).not.toBeVisible({ timeout: 15000 });
    });
  });
});
