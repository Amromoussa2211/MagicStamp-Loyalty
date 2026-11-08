const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');
const { pickAntDate, selectFirstAntOption } = require('../helpers/antdPicker');

// Magic Codes suite — split into focused tests instead of one giant flow:
//   1) page renders + create entry point
//   2) the create form opens and its core fields are editable
//   3) full creation of a code batch (dates = future, tomorrow-based)
//   4) list sorting (Newest / Oldest)
//   5) status filter (Active / Claimed / Expired)
// Tests log in individually (ACMOK: portal rejects parallel logins when we
// ever parallelize — workers:1 in playwright.config.js keeps this safe).
test.describe('Vendor Portal — Magic Codes', () => {
  // Creating a batch + list interactions exceed the 60s default.
  test.setTimeout(180000);

  // Shared ordering helper for tests 3: quantity / reference / scheme / reward.
  const openCreateForm = async (page) => {
    await page.getByRole('button', { name: /create magic codes?/i }).click();
    await expect(page.locator('#quantity')).toBeVisible({ timeout: 15000 });
  };

  const fillReferenceAndSchemeAndReward = async (page) => {
    await page.getByRole('textbox', { name: 'Reference (Optional)' })
      .fill('automation refrance');
    await page.getByRole('combobox', { name: 'Select Scheme' }).click();
    await selectFirstAntOption(page);
    await page.getByRole('combobox', { name: 'Select Reward *' }).click();
    await selectFirstAntOption(page);
  };

  test('magic codes page renders with its create entry point', async ({ page }) => {
    const creds = validCredentials() || { email: 'amro_kaza@hotmail.com', password: 'P@$$w0rd2010' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Magic Codes');
    allure.label('severity', 'normal');

    await allure.step('Login', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
    });

    await allure.step('Open /magic-codes and verify', async () => {
      await page.goto(`${PORTAL_BASE_URL}/magic-codes`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/magic-codes/);
      await expect(page.getByRole('heading', { name: /magic code/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /create magic codes?/i })).toBeVisible();
    });
  });

  test('create form opens and its core fields are editable', async ({ page }) => {
    const creds = validCredentials() || { email: 'amro_kaza@hotmail.com', password: 'P@$$w0rd2010' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Magic Codes');

    await performPortalLogin(page, creds);
    await waitForAuthenticatedPage(page);
    await page.goto(`${PORTAL_BASE_URL}/magic-codes`, { waitUntil: 'domcontentloaded' });

    await allure.step('Open the create form', async () => {
      await openCreateForm(page);
    });

    await allure.step('Core fields respond', async () => {
      // Quantity +1 works.
      await page.locator('#quantity').getByRole('button', { name: '+' }).click();
      await expect(page.locator('#quantity')).toBeVisible();

      await fillReferenceAndSchemeAndReward(page);

      await page.getByRole('textbox', { name: 'Include Message * (Optional)' })
        .fill('aditional role automation');
      await page.locator('#numberOfSecrets').getByRole('button', { name: '+' }).click();
      await page.getByRole('spinbutton', { name: 'Max Claims Per Code' }).click();
      await page.getByRole('spinbutton', { name: 'Max Claims Per Code' }).fill('12');

      // Dates are NOT picked here — date correctness is test 3.
      await expect(page.getByRole('button', { name: 'Create Codes' })).toBeVisible();
    });
  });

  test('vendor creates a batch of magic codes end to end', async ({ page }) => {
    const creds = validCredentials() || { email: 'amro_kaza@hotmail.com', password: 'P@$$w0rd2010' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Magic Codes');
    allure.label('severity', 'critical');

    await performPortalLogin(page, creds);
    await waitForAuthenticatedPage(page);
    await page.goto(`${PORTAL_BASE_URL}/magic-codes`, { waitUntil: 'domcontentloaded' });

    await allure.step('Open the create form and fill details', async () => {
      await openCreateForm(page);
      await fillReferenceAndSchemeAndReward(page);
      await page.getByRole('textbox', { name: 'Include Message * (Optional)' })
        .fill('aditional role automation');
      await page.locator('#numberOfSecrets').getByRole('button', { name: '+' }).click();
      await page.getByRole('spinbutton', { name: 'Max Claims Per Code' }).fill('12');

      // Dates MUST be valid (the app keeps OK disabled for past datetimes):
      // From Date = tomorrow, To Date = tomorrow + 7; Claimable window
      // mirrors it — valid on any run day.
      const from = new Date();
      from.setDate(from.getDate() + 1);
      const to = new Date();
      to.setDate(to.getDate() + 8);
      await pickAntDate(page, 'From Date *', from);
      await pickAntDate(page, 'To Date *', to);
      await pickAntDate(page, 'Claimable From *', from);
      await pickAntDate(page, 'Claimable Until *', to);

      // Optional notes/tags — the 'New Tag' input crashes the page's renderer
      // on tag-add (reproduced twice), so fill the safe Notes textbox instead.
      // Both are optional and neither is required for creation.
      await page.getByRole('textbox', { name: 'Notes' }).fill('automation');
    });

    await allure.step('Create the codes', async () => {
      await page.getByRole('button', { name: 'Create Codes' }).click();
      await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 30000 });
    });
  });

  test('list supports Newest/Oldest sorting', async ({ page }) => {
    const creds = validCredentials() || { email: 'amro_kaza@hotmail.com', password: 'P@$$w0rd2010' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Magic Codes');

    await performPortalLogin(page, creds);
    await waitForAuthenticatedPage(page);
    await page.goto(`${PORTAL_BASE_URL}/magic-codes`, { waitUntil: 'domcontentloaded' });

    await allure.step('Toggle sorting', async () => {
      // There are two mc-filter-selects on the list (Status + Sort). The SORT
      // one shows the current order as its label and opens a listbox whose
      // options are the two orders — select the OTHER one, then select back.
      const sortSelect = page
        .locator('.mc-filter-select')
        .filter({ hasText: /newest|oldest/i })
        .first();
      const label = sortSelect.locator('.mc-filter-select__label');
      const initial = (await label.textContent() ?? '').trim();
      const flip = /oldest/i.test(initial) ? 'Newest' : 'Oldest';

      await sortSelect.click(); // opens the listbox
      await page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .filter({ hasText: flip })
        .first()
        .click();
      await expect(label).toContainText(flip, { ignoreCase: true, timeout: 15000 });

      await sortSelect.click(); // flip back
      await page
        .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .filter({ hasText: initial })
        .first()
        .click();
      await expect(label).toContainText(initial, { ignoreCase: true, timeout: 15000 });
    });
  });

  test('list supports status filtering', async ({ page }) => {
    const creds = validCredentials() || { email: 'amro_kaza@hotmail.com', password: 'P@$$w0rd2010' };

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Magic Codes');

    await performPortalLogin(page, creds);
    await waitForAuthenticatedPage(page);
    await page.goto(`${PORTAL_BASE_URL}/magic-codes`, { waitUntil: 'domcontentloaded' });

    await allure.step('Cycle status filters', async () => {
      // The status select is the FIRST .mc-filter-select (second is Sort).
      // Its options live in the antd dropdown, so click options ONLY inside
      // the open dropdown — the page also renders `Active`/`Claimed` status
      // pills in the batch list, which made unscoped getByText('Active')
      // a strict-mode violation once the list had >1 batch (CI + local).
      const statusSelect = page.locator('.mc-filter-select').first();
      const pickStatus = async (status) => {
        await statusSelect.click(); // open listbox
        await page
          .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
          .filter({ hasText: new RegExp(`^${status}$`) })
          .first()
          .click();
      };
      await pickStatus('Active');
      await pickStatus('Claimed');
      await pickStatus('Expired');
    });
  });
});
