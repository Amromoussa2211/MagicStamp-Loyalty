/**
 * Shared Playwright fixture for ALL web specs.
 *
 * Mirrors the mobile side (wdio afterTest): after EVERY test — passed OR
 * failed — attach a screenshot of the page. allure-playwright transfers
 * testInfo attachments into the Allure report (proven by the security
 * suite's JSON attachments), so this is the reliable way to get screenshots
 * for every web test regardless of status.
 *
 * Usage in specs (single import swap):
 *   const { test, expect } = require('../fixtures/web');
 */
const base = require('@playwright/test');

const test = base.test.extend({});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'skipped' || !page) return;
  try {
    const shot = await page.screenshot();
    await testInfo.attach(`screenshot (${testInfo.status.toUpperCase()})`, {
      body: shot,
      contentType: 'image/png',
    });
  } catch {
    // page may already be closed on hard crashes — never fail the test here
  }
});

module.exports = { test, expect: base.expect };
