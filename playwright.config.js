// Playwright (web) config — writes Allure results into the SAME directory as the
// mobile WDIO suite so a single `allure generate allure-results` produces ONE
// combined report (mobile + web).
//
// Deliberate choices:
// - reporter output dir = 'allure-results' (shared with wdio.*.conf.js)
// - html reporter disabled so it never conflicts with the Allure artifact flow
// - workers: 1 for deterministic first web specs (matches mobile maxInstances: 1)
const fs = require('fs');
const { defineConfig } = require('@playwright/test');

// macOS 12: Playwright's bundled Chromium build is not supported, but a
// system-installed Chrome can drive the tests directly. CI (ubuntu) uses the
// normal downloaded Chromium.
const hasSystemChrome =
  fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const channel = process.env.PLAYWRIGHT_BROWSER || (hasSystemChrome ? 'chrome' : undefined);

module.exports = defineConfig({
  testDir: './web/specs',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['allure-playwright', { resultsDir: 'allure-results', detail: false }],
  ],

  use: {
    channel,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    baseURL: 'https://www.google.com',
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
