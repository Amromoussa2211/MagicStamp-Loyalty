const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');
const { pickAntDate } = require('../helpers/antdPicker');

// Scenario: vendor opens the Points (Gamification) tab. The area has TWO
// states — empty ("Get started / Setup points" cards) and configured
// ("Points economy overview"). Every test branches on which state is live so
// re-runs never fail just because data already exists.
test.describe('Vendor Portal — Gamification Points', () => {
  test.beforeEach(async ({ page }) => {
    const creds = validCredentials() || { email: 'amro_kaza@hotmail.com', password: 'P@$$w0rd2010' };
    await performPortalLogin(page, creds);
    await waitForAuthenticatedPage(page);
  });

  test('points landing reflects the current setup state', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Gamification Points');
    allure.label('severity', 'normal');

    await allure.step('Open the Points tab from the sidebar', async () => {
      await page.locator('aside >> text=Points').first().click();
      await expect(page).toHaveURL(/gamification/);
    });

    // Race-free state detection: the landing renders either the onboarding
    // cards ("Get started") or the configured overview — wait for the FIRST
    // of the two, THEN branch. Branching on a raw isVisible() raced with
    // slow "Signing you in…" loads and mismatched the release state.
    await page
      .getByText(/points economy overview|get started/i)
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
    const configured = await page
      .getByText(/points economy overview/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (configured) {
      await allure.step('Configured state — overview markers are visible', async () => {
        await expect(page.getByText(/points per stamp/i).first()).toBeVisible();
        await expect(page.getByText(/active rewards/i).first()).toBeVisible();
      });
    } else {
      await allure.step('Empty state — setup cards are visible', async () => {
        await expect(page.getByText(/get started/i).first()).toBeVisible();
        await expect(page.getByText(/setup points/i).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /create boost/i }).first()).toBeVisible();
      });
    }
  });

  test('points economy settings render (configure only on a fresh account)', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Gamification Points');
    allure.label('severity', 'normal');

    await allure.step('Open the gamification settings page', async () => {
      await page.goto(`${PORTAL_BASE_URL}/gamification/settings`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    });

    // Fresh account: /gamification/settings falls back to the landing page.
    const emptyState = await page.getByText(/setup points/i).first().isVisible().catch(() => false);
    if (emptyState) {
      await allure.step('Fresh account — run the points setup', async () => {
        await page.getByText(/setup points/i).first().click();
        await page.waitForTimeout(2000);
        const pointsInput = page.getByLabel(/points per stamp/i).first();
        if (await pointsInput.isVisible().catch(() => false)) {
          await pointsInput.fill('100');
        }
        await page.getByRole('button', { name: /save/i }).first().click();
        await page.waitForTimeout(2000);
        await expect(page.getByText(/points economy enabled/i).first()).toBeVisible();
      });
      return;
    }

    await allure.step('Configured state — settings form is read-only verified', async () => {
      await expect(page.getByText(/points economy enabled/i).first()).toBeVisible();
      await expect(page.getByText(/points per stamp/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible();
      // Do NOT change values — keeps the test idempotent for re-runs.
    });
  });

  test('create a boost with a unique title', async ({ page }) => {
    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Dashboard');
    allure.label('suite', 'Dashboard — Gamification Points');
    allure.label('severity', 'normal');

    const title = `automation boost ${Date.now()}`;

    await allure.step('Open the Points tab and go to boosts', async () => {
      await page.locator('aside >> text=Points').first().click();
      await expect(page).toHaveURL(/gamification/);
      const boostsLink = page.locator('a, button').filter({ hasText: /boost/i }).first();
      if (await boostsLink.isVisible().catch(() => false)) {
        await boostsLink.click();
      } else {
        await page.goto(`${PORTAL_BASE_URL}/gamification/boosts`, { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(2000);
    });

    await allure.step('Open the Create Boost form', async () => {
      const createBtn = page.locator('button').filter({ hasText: /create boost/i }).first();
      if (!(await createBtn.isVisible().catch(() => false))) {
        await page.goto(`${PORTAL_BASE_URL}/gamification/boosts/new`, { waitUntil: 'domcontentloaded' });
      } else {
        await createBtn.click();
      }
      await expect(page.getByText(/create boost/i).first()).toBeVisible();
    });

    await allure.step('Fill the boost form (dates are always future-valid)', async () => {
      await page.getByLabel(/^title$/i).first().fill(title);
      await page.getByLabel(/multiplier/i).first().fill('2');
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setDate(end.getDate() + 8);
      await pickAntDate(page, /starts at/i, start);
      await pickAntDate(page, /ends at/i, end);
    });

    await allure.step('Submit and confirm the boost appears', async () => {
      const submit = page
        .getByRole('button', { name: /create your first boost/i })
        .or(page.getByRole('button', { name: /^create boost$/i }))
        .first();
      await submit.click();
      await page.waitForTimeout(3000);
      await expect(page.getByText(title).first()).toBeVisible();
    });
  });
});
